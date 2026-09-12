import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'

await startTestServer('admin-course-completions')

let adminCookie: string
let memberCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.18.1')
  memberCookie = await signIn('member', '127.0.18.2')
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

let mitgliedZaehler = 0

/** Legt ueber die Verwaltungs-API ein frisches Mitgliedskonto an – ein eigenes je Aufruf. */
async function legeMitgliedAn() {
  mitgliedZaehler += 1
  const response = await admin('/api/admin/members', {
    method: 'POST',
    body: JSON.stringify({
      email: `abschluss-mitglied-${mitgliedZaehler}@test.local`,
      displayName: `Abschluss Mitglied ${mitgliedZaehler}`,
    }),
  })

  if (response.status !== 201) {
    throw new Error(`Mitgliedskonto konnte nicht angelegt werden (${response.status})`)
  }

  return (await response.json()) as { id: string, email: string, displayName: string }
}

function trageAbschlussEin(courseId: string, body: Record<string, unknown>, cookie: string | null = adminCookie) {
  return admin(`/api/admin/courses/${courseId}/completions`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, cookie)
}

describe('FV-18 Teilnahme-Erfassung – Abschluss-Historie', () => {
  it('AC-2: weist Unangemeldete mit 401 und Mitglieder mit 403 ab', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    expect((await trageAbschlussEin(course.id, { userId: mitglied.id }, null)).status).toBe(401)
    expect((await trageAbschlussEin(course.id, { userId: mitglied.id }, memberCookie)).status).toBe(403)
  })

  it('AC-2: trägt einen Abschluss mit Datum und Notiz ein', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    const response = await trageAbschlussEin(course.id, {
      userId: mitglied.id,
      completedAt: '2024-03-15',
      note: 'Mit Auszeichnung bestanden.',
    })

    expect(response.status).toBe(201)
    const abschluss = await response.json()
    expect(abschluss).toMatchObject({
      userId: mitglied.id,
      displayName: mitglied.displayName,
      email: mitglied.email,
      note: 'Mit Auszeichnung bestanden.',
    })
    expect(new Date(abschluss.completedAt).toISOString().slice(0, 10)).toBe('2024-03-15')
  })

  it('AC-2: fehlt completedAt, gilt das heutige Datum', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    const response = await trageAbschlussEin(course.id, { userId: mitglied.id })

    expect(response.status).toBe(201)
    const abschluss = await response.json()
    expect(new Date(abschluss.completedAt).toISOString().slice(0, 10)).toBe(
      new Date().toISOString().slice(0, 10),
    )
  })

  it('AC-3: eine unbekannte courseId liefert 404', async () => {
    const mitglied = await legeMitgliedAn()

    const response = await trageAbschlussEin('gibt-es-nicht', { userId: mitglied.id })

    expect(response.status).toBe(404)
  })

  it('AC-3: eine unbekannte userId liefert 404', async () => {
    const course = await createCourse(adminCookie)

    const response = await trageAbschlussEin(course.id, { userId: 'gibt-es-nicht' })

    expect(response.status).toBe(404)
  })

  it('AC-1, AC-3: ein bereits vorhandener Abschluss für dasselbe Paar wird mit 409 abgelehnt, kein zweiter Eintrag', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    expect((await trageAbschlussEin(course.id, { userId: mitglied.id })).status).toBe(201)
    const zweiterVersuch = await trageAbschlussEin(course.id, { userId: mitglied.id })
    expect(zweiterVersuch.status).toBe(409)

    const liste = await (await admin(`/api/admin/courses/${course.id}/completions`)).json()
    expect(liste.items.filter((item: { userId: string }) => item.userId === mitglied.id)).toHaveLength(1)
  })

  it('AC-4: completedAt darf beliebig in der Vergangenheit liegen', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    const response = await trageAbschlussEin(course.id, { userId: mitglied.id, completedAt: '2015-01-01' })

    expect(response.status).toBe(201)
  })

  it('AC-4: ein Datum in der Zukunft wird mit 400 abgelehnt', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    const response = await trageAbschlussEin(course.id, { userId: mitglied.id, completedAt: isoInDays(5) })

    expect(response.status).toBe(400)
  })

  it('AC-5: entfernt einen Abschluss wieder', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()
    await trageAbschlussEin(course.id, { userId: mitglied.id })

    const response = await admin(`/api/admin/courses/${course.id}/completions/${mitglied.id}`, { method: 'DELETE' })
    expect(response.status).toBe(200)

    const liste = await (await admin(`/api/admin/courses/${course.id}/completions`)).json()
    expect(liste.items.map((item: { userId: string }) => item.userId)).not.toContain(mitglied.id)
  })

  it('AC-5: ein unbekanntes Paar liefert 404', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()

    const response = await admin(`/api/admin/courses/${course.id}/completions/${mitglied.id}`, { method: 'DELETE' })

    expect(response.status).toBe(404)
  })

  it('AC-5: nur Admin darf einen Abschluss entfernen', async () => {
    const course = await createCourse(adminCookie)
    const mitglied = await legeMitgliedAn()
    await trageAbschlussEin(course.id, { userId: mitglied.id })

    const response = await admin(
      `/api/admin/courses/${course.id}/completions/${mitglied.id}`,
      { method: 'DELETE' },
      memberCookie,
    )

    expect(response.status).toBe(403)
  })

  it('AC-6: liefert alle Abschlüsse eines Lehrgangs mit Name, Kennung, Datum und Notiz', async () => {
    const course = await createCourse(adminCookie)
    const ersterMitglied = await legeMitgliedAn()
    const zweiterMitglied = await legeMitgliedAn()

    await trageAbschlussEin(course.id, { userId: ersterMitglied.id, completedAt: '2022-05-01' })
    await trageAbschlussEin(course.id, { userId: zweiterMitglied.id, completedAt: '2023-06-01', note: 'Nachpruefung' })

    const response = await admin(`/api/admin/courses/${course.id}/completions`)
    expect(response.status).toBe(200)

    const { items } = await response.json()
    expect(items).toHaveLength(2)
    expect(items).toContainEqual(expect.objectContaining({
      userId: ersterMitglied.id,
      displayName: ersterMitglied.displayName,
      email: ersterMitglied.email,
      note: null,
    }))
    expect(items).toContainEqual(expect.objectContaining({
      userId: zweiterMitglied.id,
      note: 'Nachpruefung',
    }))
  })
})
