import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'

await startTestServer('courses-detail')

let memberCookie: string
let adminCookie: string
let courseId: string
let bareCourseId: string
let memberId: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.2.1')
  memberCookie = await signIn('member', '127.0.2.2')

  // Ein verschachteltes `beforeAll` innerhalb eines `describe`-Blocks findet den
  // Test-Utils-Kontext nicht (`useTestContext`: "No context is available") – deshalb wird
  // `memberId` hier im obersten `beforeAll` mitgeladen, wie im Rest der Datei ueblich.
  const session = await (await fetch('/api/_auth/session', { headers: { cookie: memberCookie } })).json()
  memberId = session.user.id

  const course = await createCourse(adminCookie)
  courseId = course.id

  await fetch(`/api/admin/courses/${courseId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      description: 'Grundlagen für neue Einsatzkräfte.',
    }),
    redirect: 'manual',
  })

  const bare = await createCourse(adminCookie, { title: 'Nur schnell angelegt' })
  bareCourseId = bare.id
})

describe('FV-2 Lehrgangskatalog – Detailseite', () => {
  it('AC-11: liefert ohne Anmeldung 401', async () => {
    const response = await fetch(`/api/courses/${courseId}`, { redirect: 'manual' })

    expect(response.status).toBe(401)
  })

  it('AC-8: liefert die Beschreibung', async () => {
    const data = await (await fetch(`/api/courses/${courseId}`, { headers: { cookie: memberCookie } })).json()

    expect(data.description).toBe('Grundlagen für neue Einsatzkräfte.')
  })

  it('FV-13, AC-3: liefert keine Kategorie/Format/Ausbilder/Uhrzeit/Ort/Themen/Programm mehr', async () => {
    const data = await (await fetch(`/api/courses/${courseId}`, { headers: { cookie: memberCookie } })).json()

    expect(data).not.toHaveProperty('category')
    expect(data).not.toHaveProperty('format')
    expect(data).not.toHaveProperty('timeLabel')
    expect(data).not.toHaveProperty('location')
    expect(data).not.toHaveProperty('instructor')
    expect(data).not.toHaveProperty('topics')
    expect(data).not.toHaveProperty('days')
  })

  it('AC-8: ein schnell angelegter Lehrgang liefert eine leere Beschreibung statt Platzhaltertext', async () => {
    const data = await (await fetch(`/api/courses/${bareCourseId}`, { headers: { cookie: memberCookie } })).json()

    expect(data.description).toBeNull()
  })

  it('AC-8: liefert für einen unbekannten Lehrgang 404', async () => {
    const response = await fetch('/api/courses/gibt-es-nicht', {
      headers: { cookie: memberCookie },
      redirect: 'manual',
    })

    expect(response.status).toBe(404)
  })

  it('FV-14, AC-1: liefert keine Platzzahl mehr und meldet die Anmeldung als offen', async () => {
    const data = await (await fetch(`/api/courses/${courseId}`, { headers: { cookie: memberCookie } })).json()

    expect(data).not.toHaveProperty('capacity')
    expect(data).not.toHaveProperty('fullyBooked')
    expect(data).not.toHaveProperty('freeSeats')
    expect(data.signupOpen).toBe(true)
  })

  it('FV-14, AC-4: ein bereits begonnener Lehrgang meldet die Anmeldung als geschlossen', async () => {
    const gestern = await createCourse(adminCookie, {
      title: 'Bereits begonnen',
      startsOn: isoInDays(-1),
      endsOn: isoInDays(1),
    })

    const data = await (await fetch(`/api/courses/${gestern.id}`, { headers: { cookie: memberCookie } })).json()
    expect(data.signupOpen).toBe(false)
  })
})

describe('FV-20 Voraussetzungs-Engine & Katalog-Sichtbarkeit – Detailseite', () => {
  function putPrerequisites(courseId: string, requiredCourseIds: string[]) {
    return fetch(`/api/admin/courses/${courseId}/prerequisites`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ requiredCourseIds }),
      redirect: 'manual',
    })
  }

  function trageAbschlussEin(courseId: string, userId: string = memberId) {
    return fetch(`/api/admin/courses/${courseId}/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ userId }),
      redirect: 'manual',
    })
  }

  it('AC-5: ein Mitglied ohne erfüllte Voraussetzung bekommt 404 statt der Lehrgangsdaten', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Detail Voraussetzung' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Detail Gesperrt' })
    await putPrerequisites(course.id, [required.id])

    const response = await fetch(`/api/courses/${course.id}`, { headers: { cookie: memberCookie }, redirect: 'manual' })
    expect(response.status).toBe(404)
  })

  it('AC-5: nach Abschluss der Voraussetzung liefert dieselbe Route wieder die Lehrgangsdaten', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Detail Voraussetzung Frei' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Detail Freigeschaltet' })
    await putPrerequisites(course.id, [required.id])
    await trageAbschlussEin(required.id)

    const response = await fetch(`/api/courses/${course.id}`, { headers: { cookie: memberCookie }, redirect: 'manual' })
    expect(response.status).toBe(200)
  })

  it('AC-5: ein Mitglied, das den Lehrgang selbst schon abgeschlossen hat, sieht ihn trotz unerfüllter Voraussetzung', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Detail Voraussetzung Trotzdem' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Detail Selbst Abgeschlossen' })
    await putPrerequisites(course.id, [required.id])
    await trageAbschlussEin(course.id)

    const response = await fetch(`/api/courses/${course.id}`, { headers: { cookie: memberCookie }, redirect: 'manual' })
    expect(response.status).toBe(200)
  })

  it('AC-5: für einen Admin bleibt die Detailseite unverändert erreichbar (200 trotz unerfüllter Voraussetzung)', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Detail Voraussetzung Admin' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Detail Admin Sieht Alles' })
    await putPrerequisites(course.id, [required.id])

    const response = await fetch(`/api/courses/${course.id}`, { headers: { cookie: adminCookie }, redirect: 'manual' })
    expect(response.status).toBe(200)
  })
})
