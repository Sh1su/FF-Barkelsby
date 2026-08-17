import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, createInstructor, isoInDays } from '../factories/course'

await startTestServer('courses-list')

let guestCookie: string
let adminCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.1.1')
  guestCookie = await signIn('guest', '127.0.1.2')

  const instructor = await createInstructor(adminCookie, 'Oberbrandmeisterin Vogt')

  await createCourse(adminCookie, {
    title: 'Truppmann Grundausbildung',
    category: 'grundausbildung',
    startsOn: isoInDays(10),
    endsOn: isoInDays(12),
    instructorId: instructor.id,
  })
  await createCourse(adminCookie, {
    title: 'Atemschutzgeräteträger Fortbildung',
    category: 'atemschutz',
    startsOn: isoInDays(20),
    endsOn: isoInDays(20),
  })
  await createCourse(adminCookie, {
    title: 'Vergangener Lehrgang',
    category: 'atemschutz',
    startsOn: isoInDays(-20),
    endsOn: isoInDays(-18),
  })
  await createCourse(adminCookie, {
    title: 'Laufender Lehrgang',
    category: 'erste-hilfe',
    startsOn: isoInDays(-1),
    endsOn: isoInDays(1),
  })
})

function list(query = '', cookie = guestCookie) {
  return fetch(`/api/courses${query}`, { headers: { cookie }, redirect: 'manual' })
}

describe('FV-2 Lehrgangskatalog – Übersicht', () => {
  it('AC-11: liefert ohne Anmeldung 401', async () => {
    const response = await fetch('/api/courses', { redirect: 'manual' })

    expect(response.status).toBe(401)
  })

  it('AC-1: zeigt nur kommende und laufende Lehrgänge, sortiert nach Beginn', async () => {
    const data = await (await list()).json()
    const titles = data.items.map((item: { title: string }) => item.title)

    expect(titles).not.toContain('Vergangener Lehrgang')
    expect(titles).toContain('Laufender Lehrgang')
    expect(titles).toEqual([
      'Laufender Lehrgang',
      'Truppmann Grundausbildung',
      'Atemschutzgeräteträger Fortbildung',
    ])
  })

  it('AC-2: filtert nach Kategorie', async () => {
    const data = await (await list('?kategorie=atemschutz')).json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].title).toBe('Atemschutzgeräteträger Fortbildung')
  })

  it('AC-2: ignoriert eine unbekannte Kategorie statt zu scheitern', async () => {
    const response = await list('?kategorie=gibt-es-nicht')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items.length).toBeGreaterThan(1)
  })

  it('AC-3: sucht unabhängig von Groß- und Kleinschreibung im Titel', async () => {
    const data = await (await list('?q=TRUPPMANN')).json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].title).toBe('Truppmann Grundausbildung')
  })

  it('AC-3: sucht auch im Namen des Ausbilders', async () => {
    const data = await (await list('?q=vogt')).json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].instructorName).toBe('Oberbrandmeisterin Vogt')
  })

  it('AC-4: liefert bei erfolgloser Suche eine leere Liste statt eines Fehlers', async () => {
    const response = await list('?q=gibtesnicht')
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toEqual([])
    expect(data.total).toBe(0)
  })

  it('AC-11: ist paginiert und begrenzt die Seitengröße', async () => {
    const data = await (await list('?limit=1')).json()

    expect(data.items).toHaveLength(1)
    expect(data.limit).toBe(1)
    expect(data.total).toBe(3)

    const tooLarge = await list('?limit=500')
    expect(tooLarge.status).toBe(400)
  })

  it('AC-6: meldet Belegung und Ausgebucht-Status je Lehrgang', async () => {
    const data = await (await list('?q=Truppmann')).json()

    expect(data.items[0]).toMatchObject({
      capacity: 12,
      confirmedCount: 0,
      fullyBooked: false,
      freeSeats: 12,
    })
  })
})
