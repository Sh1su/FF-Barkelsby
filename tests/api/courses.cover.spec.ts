import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'

await startTestServer('courses-cover')

let guestCookie: string
let adminCookie: string
let courseId: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.3.1')
  guestCookie = await signIn('guest', '127.0.3.2')
  courseId = (await createCourse(adminCookie, { title: 'Motivtest <b>Lehrgang</b>' })).id
})

function cover(query = '', cookie = guestCookie) {
  return fetch(`/api/courses/${courseId}/cover.svg${query}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  })
}

describe('FV-2 Lehrgangskatalog – generiertes Titelbild', () => {
  it('AC-11: liefert ohne Anmeldung 401', async () => {
    expect((await cover('', '')).status).toBe(401)
  })

  it('AC-9: liefert ein SVG mit passendem Content-Type', async () => {
    const response = await cover()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(await response.text()).toContain('<svg')
  })

  it('AC-9: ist deterministisch – zwei Abrufe liefern dasselbe Bild', async () => {
    const first = await (await cover()).text()
    const second = await (await cover()).text()

    expect(first).toBe(second)
  })

  it('AC-9: übernimmt keinen Nutzertext als Markup (Bildbeschreibung)', async () => {
    const svg = await (await cover()).text()

    expect(svg).not.toContain('<b>')
    expect(svg).toContain('&lt;b&gt;')
  })

  it('AC-9: kennt Karten- und Hero-Variante', async () => {
    const card = await (await cover('?variant=card')).text()
    const hero = await (await cover('?variant=hero')).text()

    expect(card).toContain('viewBox="0 0 800 320"')
    expect(hero).toContain('viewBox="0 0 1180 340"')
  })

  it('AC-9: weist eine unbekannte Variante mit 400 ab', async () => {
    expect((await cover('?variant=poster')).status).toBe(400)
  })

  it('AC-10: ein Lehrgang ohne gesetztes Motiv bekommt trotzdem ein Bild', async () => {
    const svg = await (await cover()).text()

    expect(svg).toContain('</svg>')
    expect(svg.length).toBeGreaterThan(200)
  })

  it('liefert für einen unbekannten Lehrgang 404', async () => {
    const response = await fetch('/api/courses/unbekannt/cover.svg', {
      headers: { cookie: guestCookie },
      redirect: 'manual',
    })

    expect(response.status).toBe(404)
  })
})
