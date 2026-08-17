import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, createInstructor, isoInDays } from '../factories/course'

await startTestServer('courses-detail')

let guestCookie: string
let adminCookie: string
let courseId: string
let bareCourseId: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.2.1')
  guestCookie = await signIn('guest', '127.0.2.2')

  const instructor = await createInstructor(adminCookie)
  const course = await createCourse(adminCookie, { instructorId: instructor.id })
  courseId = course.id

  await fetch(`/api/admin/courses/${courseId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      description: 'Grundlagen für neue Einsatzkräfte.',
      topics: ['Rechtsgrundlagen', 'Fahrzeugkunde'],
      days: [
        { dayNumber: 1, date: isoInDays(14), timeLabel: '18:30 – 21:00', title: 'Theorie', bullets: ['Recht', 'Technik'] },
        { dayNumber: 2, date: isoInDays(15), timeLabel: '09:00 – 16:00', title: 'Praxis' },
      ],
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

  it('AC-8: liefert Beschreibung, Themen, Programm und Ausbilder', async () => {
    const data = await (await fetch(`/api/courses/${courseId}`, { headers: { cookie: guestCookie } })).json()

    expect(data.description).toBe('Grundlagen für neue Einsatzkräfte.')
    expect(data.topics).toEqual(['Rechtsgrundlagen', 'Fahrzeugkunde'])
    expect(data.days).toHaveLength(2)
    expect(data.days[0]).toMatchObject({ dayNumber: 1, title: 'Theorie', bullets: ['Recht', 'Technik'] })
    expect(data.instructor).toMatchObject({ name: 'Hauptbrandmeister Krause', role: 'Ausbilder Atemschutz' })
  })

  it('AC-8: ein schnell angelegter Lehrgang liefert leere Abschnitte statt Platzhaltertexten', async () => {
    const data = await (await fetch(`/api/courses/${bareCourseId}`, { headers: { cookie: guestCookie } })).json()

    expect(data.description).toBeNull()
    expect(data.topics).toBeNull()
    expect(data.days).toEqual([])
    expect(data.instructor).toBeNull()
  })

  it('AC-8: liefert für einen unbekannten Lehrgang 404', async () => {
    const response = await fetch('/api/courses/gibt-es-nicht', {
      headers: { cookie: guestCookie },
      redirect: 'manual',
    })

    expect(response.status).toBe(404)
  })
})
