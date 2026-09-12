import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'

await startTestServer('courses-list')

let memberCookie: string
let adminCookie: string
let memberId: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.1.1')
  memberCookie = await signIn('member', '127.0.1.2')

  // Ein verschachteltes `beforeAll` innerhalb eines `describe`-Blocks findet den
  // Test-Utils-Kontext nicht (`useTestContext`: "No context is available") – deshalb wird
  // `memberId` hier im obersten `beforeAll` mitgeladen, wie im Rest der Datei ueblich.
  const session = await (await fetch('/api/_auth/session', { headers: { cookie: memberCookie } })).json()
  memberId = session.user.id

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

function list(query = '', cookie = memberCookie) {
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

describe('FV-20 Voraussetzungs-Engine & Katalog-Sichtbarkeit – Katalog-Filter', () => {
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

  function ids(data: { items: { id: string }[] }) {
    return data.items.map(item => item.id)
  }

  it('AC-3: ein Lehrgang mit unerfüllter Voraussetzung erscheint für ein Mitglied nicht in der Liste', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Liste Voraussetzung' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Liste Gesperrt' })
    await putPrerequisites(course.id, [required.id])

    const data = await (await list(`?q=${encodeURIComponent(course.title)}`)).json()
    expect(ids(data)).not.toContain(course.id)
  })

  it('AC-3: nach Abschluss der Voraussetzung erscheint der Lehrgang für dasselbe Mitglied wieder', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Liste Voraussetzung Frei' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Liste Freigeschaltet' })
    await putPrerequisites(course.id, [required.id])
    await trageAbschlussEin(required.id)

    const data = await (await list(`?q=${encodeURIComponent(course.title)}`)).json()
    expect(ids(data)).toContain(course.id)
  })

  it('AC-4: ein Admin sieht denselben Lehrgang trotz unerfüllter Voraussetzung unverändert', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Liste Voraussetzung Admin' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Liste Admin Sieht Alles' })
    await putPrerequisites(course.id, [required.id])

    const data = await (await list(`?q=${encodeURIComponent(course.title)}`, adminCookie)).json()
    expect(ids(data)).toContain(course.id)
  })

  it('AC-6: ein Lehrgang ohne jede Voraussetzung bleibt für jedes Mitglied sichtbar (Regressionsschutz)', async () => {
    const course = await createCourse(adminCookie, { title: 'FV-20 Liste Ohne Voraussetzung' })

    const data = await (await list(`?q=${encodeURIComponent(course.title)}`)).json()
    expect(ids(data)).toContain(course.id)
  })

  it('AC-7: filtert mehrere Lehrgänge in einem Aufruf korrekt (Batch statt einer Abfrage je Lehrgang)', async () => {
    const reqA = await createCourse(adminCookie, { title: 'FV-20 Batch Voraussetzung Eins' })
    const reqB = await createCourse(adminCookie, { title: 'FV-20 Batch Voraussetzung Zwei' })
    const gesperrt = await createCourse(adminCookie, { title: 'FV-20 Batch Gesperrt' })
    const frei = await createCourse(adminCookie, { title: 'FV-20 Batch Frei' })
    const ohneVoraussetzung = await createCourse(adminCookie, { title: 'FV-20 Batch Ohne Voraussetzung' })

    await putPrerequisites(gesperrt.id, [reqA.id])
    await putPrerequisites(frei.id, [reqB.id])
    await trageAbschlussEin(reqB.id)

    const data = await (await list(`?q=${encodeURIComponent('FV-20 Batch')}`)).json()
    const sichtbar = ids(data)

    expect(sichtbar).toContain(reqA.id)
    expect(sichtbar).toContain(reqB.id)
    expect(sichtbar).toContain(frei.id)
    expect(sichtbar).toContain(ohneVoraussetzung.id)
    expect(sichtbar).not.toContain(gesperrt.id)
  })
})
