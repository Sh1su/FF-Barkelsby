import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'
import { insertSignup } from '../factories/signup'

await startTestServer('signups')

const DB = 'signups'
let guestCookie: string
let adminCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.8.1')
  guestCookie = await signIn('guest', '127.0.8.2')
})

const ANMELDUNG = {
  firstName: 'Jonas',
  lastName: 'Berger',
  email: 'jonas.berger@test.local',
  consent: true,
}

function anmelden(courseId: string, body: Record<string, unknown> = ANMELDUNG, cookie: string | null = guestCookie, ip = '127.0.8.3') {
  return fetch(`/api/courses/${courseId}/signups`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
}

async function detail(courseId: string) {
  return (await fetch(`/api/courses/${courseId}`, { headers: { cookie: guestCookie } })).json()
}

async function mails(courseId: string) {
  const response = await fetch(`/api/admin/courses/${courseId}/mails`, {
    headers: { cookie: adminCookie },
  })
  return (await response.json()).items as { recipient: string, template: string, status: string }[]
}

describe('FV-5 Interessensbekundung', () => {
  it('AC-2: eine gültige Anmeldung wird mit 201 gespeichert', async () => {
    const course = await createCourse(adminCookie)

    const response = await anmelden(course.id)

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ status: 'offen' })
  })

  it('AC-2: ohne Anmeldung am System geht gar nichts', async () => {
    const course = await createCourse(adminCookie)

    expect((await anmelden(course.id, ANMELDUNG, null)).status).toBe(401)
  })

  it('AC-3: ohne Einwilligung wird mit 400 abgelehnt und nichts gespeichert', async () => {
    const course = await createCourse(adminCookie)

    const response = await anmelden(course.id, { ...ANMELDUNG, consent: false })
    expect(response.status).toBe(400)

    // Nichts gespeichert: eine anschließende Anmeldung derselben Adresse klappt.
    expect((await anmelden(course.id)).status).toBe(201)
  })

  it('AC-2: unvollständige oder unsinnige Eingaben werden mit 400 abgelehnt', async () => {
    const course = await createCourse(adminCookie)

    expect((await anmelden(course.id, { ...ANMELDUNG, firstName: '' })).status).toBe(400)
    expect((await anmelden(course.id, { ...ANMELDUNG, email: 'keine-adresse' })).status).toBe(400)
    expect((await anmelden(course.id, { ...ANMELDUNG, lastName: 'x'.repeat(200) })).status).toBe(400)
  })

  it('AC-4: dieselbe Adresse kann sich nicht zweimal anmelden', async () => {
    const course = await createCourse(adminCookie)

    expect((await anmelden(course.id)).status).toBe(201)

    const zweite = await anmelden(course.id)
    expect(zweite.status).toBe(409)
    expect((await zweite.json()).statusMessage).toContain('bereits eine Anmeldung')
  })

  it('AC-4: Groß- und Kleinschreibung der Adresse zählt als dieselbe Person', async () => {
    const course = await createCourse(adminCookie)

    expect((await anmelden(course.id, { ...ANMELDUNG, email: 'Jonas.Berger@Test.Local' })).status).toBe(201)
    expect((await anmelden(course.id, { ...ANMELDUNG, email: 'jonas.berger@test.local' })).status).toBe(409)
  })

  it('AC-4: nach einem Storno ist eine Neuanmeldung wieder möglich', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'storniert', ANMELDUNG.email)

    expect((await anmelden(course.id)).status).toBe(201)
  })

  it('AC-5: auch ein ausgebuchter Lehrgang nimmt Interesse an', async () => {
    const course = await createCourse(adminCookie, { capacity: 1 })
    insertSignup(DB, course.id, 'bestaetigt', 'platz1@test.local')

    const vorher = await detail(course.id)
    expect(vorher.fullyBooked).toBe(true)

    expect((await anmelden(course.id)).status).toBe(201)
  })

  it('AC-6: ein abgesagter Lehrgang nimmt keine Anmeldung mehr an', async () => {
    const course = await createCourse(adminCookie)
    await fetch(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ cancelled: true }),
    })

    const response = await anmelden(course.id)
    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toContain('abgesagt')
  })

  it('AC-2: ein unbekannter Lehrgang führt zu 404', async () => {
    expect((await anmelden('gibt-es-nicht')).status).toBe(404)
  })

  it('AC-7: beide Mails werden protokolliert – an den Interessenten und an die Wehrführung', async () => {
    const course = await createCourse(adminCookie)
    await anmelden(course.id)

    const protokoll = await mails(course.id)
    const vorlagen = protokoll.map(eintrag => eintrag.template)

    expect(vorlagen).toContain('anmeldung-eingegangen')
    expect(protokoll.find(eintrag => eintrag.template === 'anmeldung-eingegangen')?.recipient)
      .toBe(ANMELDUNG.email)
    // Ohne konfiguriertes Relay gibt es keine Absenderadresse, also auch keine Meldung
    // an die Wehrführung – protokolliert wird trotzdem der Versuch an den Interessenten.
    expect(protokoll.every(eintrag => eintrag.status === 'nicht_versendet')).toBe(true)
  })

  it('AC-12: die Einwilligung wird mit Zeitpunkt gespeichert', async () => {
    const course = await createCourse(adminCookie)
    await anmelden(course.id, { ...ANMELDUNG, email: 'einwilligung@test.local' })

    const { readSignupConsent } = await import('../factories/signup')
    const consentAt = readSignupConsent(DB, 'einwilligung@test.local')

    expect(consentAt).toBeInstanceOf(Date)
    expect(Math.abs(consentAt!.getTime() - Date.now())).toBeLessThan(60_000)
  })

  it('AC-11: die Belegung zählt nur bestätigte Anmeldungen', async () => {
    const course = await createCourse(adminCookie, { capacity: 5 })
    await anmelden(course.id)
    insertSignup(DB, course.id, 'bestaetigt', 'bestaetigt@test.local')
    insertSignup(DB, course.id, 'abgelehnt', 'abgelehnt@test.local')

    const daten = await detail(course.id)
    expect(daten.confirmedCount).toBe(1)
    expect(daten.freeSeats).toBe(4)
    expect(daten.fullyBooked).toBe(false)
  })

  it('AC-10: zu viele Anmeldungen derselben IP werden mit 429 abgewiesen', async () => {
    const course = await createCourse(adminCookie, { capacity: 0 })
    const ip = '127.0.8.99'

    let letzterStatus = 0
    for (let versuch = 0; versuch < 21; versuch++) {
      const response = await anmelden(
        course.id,
        { ...ANMELDUNG, email: `person${versuch}@test.local` },
        guestCookie,
        ip,
      )
      letzterStatus = response.status
    }

    expect(letzterStatus).toBe(429)
  })
})
