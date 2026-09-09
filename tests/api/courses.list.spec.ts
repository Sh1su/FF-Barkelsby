import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'

await startTestServer('courses-list')

let guestCookie: string
let adminCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.1.1')
  guestCookie = await signIn('guest', '127.0.1.2')

  await createCourse(adminCookie, {
    title: 'Truppmann Grundausbildung',
    startsOn: isoInDays(10),
    endsOn: isoInDays(12),
  })
  await createCourse(adminCookie, {
    title: 'Atemschutzgeräteträger Fortbildung',
    startsOn: isoInDays(20),
    endsOn: isoInDays(20),
  })
  await createCourse(adminCookie, {
    title: 'Vergangener Lehrgang',
    startsOn: isoInDays(-20),
    endsOn: isoInDays(-18),
  })
  await createCourse(adminCookie, {
    title: 'Laufender Lehrgang',
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

  it('AC-3: sucht unabhängig von Groß- und Kleinschreibung im Titel', async () => {
    const data = await (await list('?q=TRUPPMANN')).json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].title).toBe('Truppmann Grundausbildung')
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

  it('AC-6: meldet die Belegung je Lehrgang', async () => {
    const data = await (await list('?q=Truppmann')).json()

    expect(data.items[0]).toMatchObject({
      confirmedCount: 0,
      signupOpen: true,
    })
  })

  it('FV-13, AC-3: Karten enthalten keine Kategorie/Format/Ausbilder-Felder mehr', async () => {
    const data = await (await list('?q=Truppmann')).json()

    expect(data.items[0]).not.toHaveProperty('category')
    expect(data.items[0]).not.toHaveProperty('format')
    expect(data.items[0]).not.toHaveProperty('timeLabel')
    expect(data.items[0]).not.toHaveProperty('location')
    expect(data.items[0]).not.toHaveProperty('instructorName')
  })

  it('FV-14, AC-1: Karten enthalten keine Platzzahl mehr', async () => {
    const data = await (await list('?q=Truppmann')).json()

    expect(data.items[0]).not.toHaveProperty('capacity')
    expect(data.items[0]).not.toHaveProperty('fullyBooked')
    expect(data.items[0]).not.toHaveProperty('freeSeats')
  })
})
