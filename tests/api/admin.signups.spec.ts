import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'
import { insertSignup } from '../factories/signup'

await startTestServer('admin-signups')

const DB = 'admin-signups'
let adminCookie: string
let guestCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.10.1')
  guestCookie = await signIn('guest', '127.0.10.2')
})

function admin(path: string, init: RequestInit = {}, cookie: string | null = adminCookie) {
  return fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
    redirect: 'manual',
  })
}

async function registratur(query = '') {
  return (await admin(`/api/admin/signups${query}`)).json()
}

function setzeStatus(id: string, status: string) {
  return admin(`/api/admin/signups/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

async function mails(courseId: string) {
  const response = await admin(`/api/admin/courses/${courseId}/mails`)
  return (await response.json()).items as { template: string, recipient: string, status: string }[]
}

describe('FV-6 Registratur – Liste', () => {
  it('AC-9: nur Admins sehen die Registratur', async () => {
    expect((await admin('/api/admin/signups', {}, null)).status).toBe(401)
    expect((await admin('/api/admin/signups', {}, guestCookie)).status).toBe(403)
  })

  it('AC-1: zeigt Name, E-Mail, Lehrgang, Anmeldedatum und Status', async () => {
    const course = await createCourse(adminCookie, { title: 'Registratur-Lehrgang' })
    insertSignup(DB, course.id, 'offen', 'liste@test.local')

    const daten = await registratur(`?lehrgang=${course.id}`)

    expect(daten.items).toHaveLength(1)
    expect(daten.items[0]).toMatchObject({
      firstName: 'Testi',
      lastName: 'Teilnehmer',
      email: 'liste@test.local',
      status: 'offen',
      courseTitle: 'Registratur-Lehrgang',
    })
    expect(daten.items[0].createdAt).toBeTruthy()
  })

  it('AC-2: filtert nach Status', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'filter-offen@test.local')
    insertSignup(DB, course.id, 'bestaetigt', 'filter-bestaetigt@test.local')

    const offen = await registratur(`?lehrgang=${course.id}&status=offen`)
    expect(offen.items.map((eintrag: { email: string }) => eintrag.email))
      .toEqual(['filter-offen@test.local'])

    const bestaetigt = await registratur(`?lehrgang=${course.id}&status=bestaetigt`)
    expect(bestaetigt.items.map((eintrag: { email: string }) => eintrag.email))
      .toEqual(['filter-bestaetigt@test.local'])
  })

  it('AC-2: ein unsinniger Statusfilter wird ignoriert statt zu scheitern', async () => {
    const response = await admin('/api/admin/signups?status=quatsch')

    expect(response.status).toBe(200)
  })

  it('AC-10: die Liste ist paginiert und begrenzt', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'seite1@test.local')
    insertSignup(DB, course.id, 'offen', 'seite2@test.local')

    const daten = await registratur(`?lehrgang=${course.id}&limit=1`)
    expect(daten.items).toHaveLength(1)
    expect(daten.total).toBe(2)

    expect((await admin('/api/admin/signups?limit=500')).status).toBe(400)
  })

  it('AC-11: die Zusammenfassung nennt die Zahl je Status', async () => {
    const daten = await registratur()

    expect(typeof daten.summary).toBe('object')
    expect(daten.summary.offen).toBeGreaterThan(0)
  })
})

describe('FV-6 Registratur – Entscheidungen', () => {
  it('AC-3/AC-5: Bestätigen setzt den Status und verschickt die Zusage', async () => {
    const course = await createCourse(adminCookie)
    const signupId = insertSignup(DB, course.id, 'offen', 'zusage@test.local')

    const response = await setzeStatus(signupId, 'bestaetigt')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'bestaetigt' })

    const protokoll = await mails(course.id)
    expect(protokoll).toHaveLength(1)
    expect(protokoll[0]).toMatchObject({
      template: 'anmeldung-bestaetigt',
      recipient: 'zusage@test.local',
    })
  })

  it('AC-3/AC-5: Ablehnen setzt den Status und verschickt die Absage', async () => {
    const course = await createCourse(adminCookie)
    const signupId = insertSignup(DB, course.id, 'offen', 'absage@test.local')

    await setzeStatus(signupId, 'abgelehnt')

    const protokoll = await mails(course.id)
    expect(protokoll[0]).toMatchObject({
      template: 'anmeldung-abgelehnt',
      recipient: 'absage@test.local',
    })
  })

  it('AC-5: Rückgängig verschickt keine Mail', async () => {
    const course = await createCourse(adminCookie)
    const signupId = insertSignup(DB, course.id, 'offen', 'rueckgaengig@test.local')

    await setzeStatus(signupId, 'bestaetigt')
    const response = await setzeStatus(signupId, 'offen')

    expect(await response.json()).toMatchObject({ status: 'offen' })
    // Nur die Zusage von vorhin, keine zweite Nachricht.
    expect(await mails(course.id)).toHaveLength(1)
  })

  it('AC-4: aus einem Storno macht die Verwaltung keine Zusage', async () => {
    const course = await createCourse(adminCookie)
    const signupId = insertSignup(DB, course.id, 'storniert', 'storniert@test.local')

    const response = await setzeStatus(signupId, 'bestaetigt')

    expect(response.status).toBe(422)
    expect(await mails(course.id)).toEqual([])
  })

  it('AC-4: ein unbekannter Zielstatus wird mit 400 abgelehnt', async () => {
    const course = await createCourse(adminCookie)
    const signupId = insertSignup(DB, course.id, 'offen')

    expect((await setzeStatus(signupId, 'storniert')).status).toBe(400)
    expect((await setzeStatus(signupId, 'quatsch')).status).toBe(400)
  })

  it('AC-3: eine unbekannte Anmeldung führt zu 404', async () => {
    expect((await setzeStatus('gibt-es-nicht', 'bestaetigt')).status).toBe(404)
  })

  it('AC-9: ein Gast darf nichts entscheiden', async () => {
    const course = await createCourse(adminCookie)
    const signupId = insertSignup(DB, course.id, 'offen')

    const response = await admin(
      `/api/admin/signups/${signupId}`,
      { method: 'PATCH', body: JSON.stringify({ status: 'bestaetigt' }) },
      guestCookie,
    )

    expect(response.status).toBe(403)
  })

  it('AC-6: Bestätigungen über die Platzzahl hinaus sind möglich und werden gekennzeichnet', async () => {
    const course = await createCourse(adminCookie, { capacity: 1 })
    const ersterId = insertSignup(DB, course.id, 'offen', 'platz1@test.local')
    const zweiterId = insertSignup(DB, course.id, 'offen', 'platz2@test.local')

    expect((await setzeStatus(ersterId, 'bestaetigt')).status).toBe(200)
    expect((await setzeStatus(zweiterId, 'bestaetigt')).status).toBe(200)

    const daten = await registratur(`?lehrgang=${course.id}&status=bestaetigt`)
    const markiert = daten.items.filter((eintrag: { ueberKapazitaet: boolean }) => eintrag.ueberKapazitaet)

    expect(daten.items).toHaveLength(2)
    expect(markiert).toHaveLength(1)
  })
})
