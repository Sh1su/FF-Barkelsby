import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'
import { insertSignup } from '../factories/signup'

await startTestServer('abmeldung')

const DB = 'abmeldung'
let adminCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.9.1')
})

/** Bewusst ohne Cookie: der Abmelde-Link kommt aus einer E-Mail, nicht aus der Anwendung. */
function ohneAnmeldung(path: string, init: RequestInit = {}) {
  return fetch(path, { ...init, redirect: 'manual' })
}

describe('FV-5 Selbstabmeldung über den Token-Link', () => {
  it('AC-8: der Link funktioniert ohne Anmeldung und zeigt die Anmeldung', async () => {
    const course = await createCourse(adminCookie, { title: 'Storno-Lehrgang' })
    const token = randomUUID()
    insertSignup(DB, course.id, 'offen', 'storno@test.local', token)

    const response = await ohneAnmeldung(`/api/abmeldung/${token}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      firstName: 'Testi',
      status: 'offen',
      courseTitle: 'Storno-Lehrgang',
    })
  })

  it('AC-8: der Klick setzt die Anmeldung auf storniert', async () => {
    const course = await createCourse(adminCookie)
    const token = randomUUID()
    insertSignup(DB, course.id, 'offen', 'storno2@test.local', token)

    const response = await ohneAnmeldung(`/api/abmeldung/${token}`, { method: 'POST' })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'storniert', bereitsStorniert: false })
  })

  it('AC-8: ein zweiter Klick ist kein Fehler', async () => {
    const course = await createCourse(adminCookie)
    const token = randomUUID()
    insertSignup(DB, course.id, 'offen', 'storno3@test.local', token)

    await ohneAnmeldung(`/api/abmeldung/${token}`, { method: 'POST' })
    const zweiterKlick = await ohneAnmeldung(`/api/abmeldung/${token}`, { method: 'POST' })

    expect(zweiterKlick.status).toBe(200)
    expect(await zweiterKlick.json()).toMatchObject({ bereitsStorniert: true })
  })

  it('AC-9: ein unbekannter Token verrät nichts', async () => {
    const response = await ohneAnmeldung(`/api/abmeldung/${randomUUID()}`)
    const koerper = await response.text()

    expect(response.status).toBe(404)
    expect(koerper).not.toContain('@test.local')
    expect(koerper).not.toContain('Testi')
  })

  it('AC-9: ein zu kurzer Token wird als ungültige Eingabe abgewiesen', async () => {
    expect((await ohneAnmeldung('/api/abmeldung/kurz')).status).toBe(400)
  })

  it('AC-11: nach dem Storno zählt die Anmeldung nicht mehr zur Belegung', async () => {
    const course = await createCourse(adminCookie, { capacity: 2 })
    const token = randomUUID()
    insertSignup(DB, course.id, 'bestaetigt', 'zaehlt@test.local', token)

    const guestCookie = await signIn('guest', '127.0.9.2')
    const vorher = await (await fetch(`/api/courses/${course.id}`, { headers: { cookie: guestCookie } })).json()
    expect(vorher.confirmedCount).toBe(1)

    await ohneAnmeldung(`/api/abmeldung/${token}`, { method: 'POST' })

    const nachher = await (await fetch(`/api/courses/${course.id}`, { headers: { cookie: guestCookie } })).json()
    expect(nachher.confirmedCount).toBe(0)
  })
})
