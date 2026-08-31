import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'
import { insertSignup } from '../factories/signup'

await startTestServer('admin-courses')

let adminCookie: string
let guestCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.4.1')
  guestCookie = await signIn('guest', '127.0.4.2')
})

/** `null` bedeutet ausdruecklich "ohne Anmeldung" – `undefined` wuerde den Default greifen lassen. */
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

describe('FV-3 Admin-Kalender – Anlegen', () => {
  it('AC-13: weist Gäste mit 403 und Unangemeldete mit 401 ab', async () => {
    expect((await admin('/api/admin/courses', {}, null)).status).toBe(401)
    expect((await admin('/api/admin/courses', {}, guestCookie)).status).toBe(403)
  })

  it('AC-5: legt einen Lehrgang mit den Feldern der Schnellanlage an', async () => {
    const response = await admin('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Maschinistenlehrgang',
        startsOn: isoInDays(30),
        endsOn: isoInDays(31),
      }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      title: 'Maschinistenlehrgang',
      status: 'geplant',
    })
  })

  it('FV-14, AC-1: eine mitgeschickte Platzzahl wird ignoriert – es gibt das Feld nicht mehr', async () => {
    const response = await admin('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ohne Plätze',
        startsOn: isoInDays(30),
        endsOn: isoInDays(31),
        capacity: 0,
      }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).not.toHaveProperty('capacity')
  })

  it('AC-6: weist ein Ende vor dem Beginn mit 400 ab', async () => {
    const response = await admin('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Rückwärtslehrgang',
        startsOn: isoInDays(10),
        endsOn: isoInDays(5),
      }),
    })

    expect(response.status).toBe(400)
  })

  it('AC-5: übernimmt Status und Belegung niemals aus dem Request-Body', async () => {
    const response = await admin('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Untergeschobener Status',
        startsOn: isoInDays(40),
        endsOn: isoInDays(40),
        status: 'abgesagt',
        confirmedCount: 99,
      }),
    })

    expect(await response.json()).toMatchObject({ status: 'geplant' })
  })

  it('AC-7: der neue Lehrgang taucht sofort im Kalender auf', async () => {
    const created = await createCourse(adminCookie, { title: 'Sofort sichtbar' })
    const data = await (await admin('/api/admin/courses')).json()

    expect(data.items.map((item: { id: string }) => item.id)).toContain(created.id)
  })

  it('AC-3: der Kalenderausschnitt enthält auch Lehrgänge, die den Zeitraum nur berühren', async () => {
    const course = await createCourse(adminCookie, {
      title: 'Über den Monatswechsel',
      startsOn: isoInDays(25),
      endsOn: isoInDays(40),
    })

    const data = await (await admin(`/api/admin/courses?von=${isoInDays(35)}&bis=${isoInDays(45)}`)).json()

    expect(data.items.map((item: { id: string }) => item.id)).toContain(course.id)
  })
})

describe('FV-3 Admin-Kalender – Bearbeiten', () => {
  it('AC-8: speichert Beschreibung und Themen', async () => {
    const course = await createCourse(adminCookie)

    const response = await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'Ausführliche Beschreibung.',
        topics: ['Thema A', 'Thema B'],
      }),
    })

    expect(response.status).toBe(200)

    const detail = await (await fetch(`/api/courses/${course.id}`, { headers: { cookie: guestCookie } })).json()
    expect(detail.description).toBe('Ausführliche Beschreibung.')
    expect(detail.topics).toEqual(['Thema A', 'Thema B'])
  })

  it('AC-9: speichert Programmtage in der übergebenen Reihenfolge', async () => {
    const course = await createCourse(adminCookie)

    await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        days: [
          { dayNumber: 1, title: 'Erster Tag' },
          { dayNumber: 2, title: 'Zweiter Tag' },
          { dayNumber: 3, title: 'Dritter Tag' },
        ],
      }),
    })

    // Umsortieren: der dritte Tag wird zum ersten.
    await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        days: [
          { dayNumber: 1, title: 'Dritter Tag' },
          { dayNumber: 2, title: 'Erster Tag' },
          { dayNumber: 3, title: 'Zweiter Tag' },
        ],
      }),
    })

    const detail = await (await fetch(`/api/courses/${course.id}`, { headers: { cookie: guestCookie } })).json()
    expect(detail.days.map((day: { title: string }) => day.title)).toEqual([
      'Dritter Tag',
      'Erster Tag',
      'Zweiter Tag',
    ])
  })

  it('AC-6: weist beim Bearbeiten ein Ende vor dem Beginn ab', async () => {
    const course = await createCourse(adminCookie)

    const response = await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ startsOn: isoInDays(20), endsOn: isoInDays(10) }),
    })

    expect(response.status).toBe(400)
  })

  it('AC-8: liefert für einen unbekannten Lehrgang 404', async () => {
    const response = await admin('/api/admin/courses/gibt-es-nicht', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Egal' }),
    })

    expect(response.status).toBe(404)
  })

  it('Edge Case: gleichzeitige Bearbeitung wird mit 409 abgelehnt', async () => {
    const course = await createCourse(adminCookie)

    const response = await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Zweiter Schreiber', updatedAt: 1 }),
    })

    expect(response.status).toBe(409)
  })
})

describe('FV-3 Admin-Kalender – Absagen und Löschen', () => {
  it('AC-10: setzt den Status auf abgesagt, der Lehrgang bleibt sichtbar', async () => {
    const course = await createCourse(adminCookie, { title: 'Wird abgesagt' })

    const response = await admin(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled: true }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'abgesagt' })

    const list = await (await fetch('/api/courses?q=Wird abgesagt', { headers: { cookie: guestCookie } })).json()
    expect(list.items[0]).toMatchObject({ status: 'abgesagt' })
  })

  it('AC-11: nimmt eine Absage wieder zurück', async () => {
    const course = await createCourse(adminCookie)

    await admin(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled: true }),
    })
    const response = await admin(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled: false }),
    })

    expect(await response.json()).toMatchObject({ status: 'geplant' })
  })

  it('AC-12: löscht einen Lehrgang ohne Anmeldungen', async () => {
    const course = await createCourse(adminCookie)

    const response = await admin(`/api/admin/courses/${course.id}`, { method: 'DELETE' })
    expect(response.status).toBe(200)

    const detail = await fetch(`/api/courses/${course.id}`, {
      headers: { cookie: guestCookie },
      redirect: 'manual',
    })
    expect(detail.status).toBe(404)
  })

  it('AC-12: verweigert das Löschen, sobald es Anmeldungen gibt', async () => {
    const course = await createCourse(adminCookie)
    insertSignup('admin-courses', course.id, 'offen')

    const response = await admin(`/api/admin/courses/${course.id}`, { method: 'DELETE' })

    expect(response.status).toBe(409)
    expect((await response.json()).statusMessage).toContain('absagen')
  })

  it('AC-12: auch eine stornierte Anmeldung verhindert das Löschen', async () => {
    const course = await createCourse(adminCookie)
    insertSignup('admin-courses', course.id, 'storniert')

    expect((await admin(`/api/admin/courses/${course.id}`, { method: 'DELETE' })).status).toBe(409)
  })

  it('FV-14, AC-1: eine mitgeschickte Platzzahl beim Bearbeiten wird ignoriert', async () => {
    const course = await createCourse(adminCookie)

    const response = await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ capacity: 0 }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('capacity')
  })

  it('AC-6: Belegung zählt nur bestätigte Anmeldungen', async () => {
    const course = await createCourse(adminCookie, { title: 'Belegungstest' })
    insertSignup('admin-courses', course.id, 'bestaetigt')
    insertSignup('admin-courses', course.id, 'offen')

    const data = await (await admin('/api/admin/courses')).json()
    const row = data.items.find((item: { id: string }) => item.id === course.id)

    expect(row.confirmedCount).toBe(1)
  })

  it('AC-13: ein Gast darf weder absagen noch löschen', async () => {
    const course = await createCourse(adminCookie)

    expect((await admin(`/api/admin/courses/${course.id}`, { method: 'DELETE' }, guestCookie)).status).toBe(403)
    expect(
      (await admin(
        `/api/admin/courses/${course.id}/cancel`,
        { method: 'POST', body: JSON.stringify({ cancelled: true }) },
        guestCookie,
      )).status,
    ).toBe(403)
  })
})

describe('FV-13 Lehrgangsfelder reduzieren – Ausbilder-Verwaltung entfernt', () => {
  it('AC-6: GET und POST /api/admin/instructors existieren nicht mehr', async () => {
    expect((await admin('/api/admin/instructors')).status).toBe(404)
    expect((await admin('/api/admin/instructors', { method: 'POST', body: JSON.stringify({ name: 'x' }) })).status).toBe(404)
  })
})
