import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'

await startTestServer('admin-course-prerequisites')

let adminCookie: string
let memberCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.6.1')
  memberCookie = await signIn('member', '127.0.6.2')
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

function putPrerequisites(courseId: string, requiredCourseIds: string[]) {
  return admin(`/api/admin/courses/${courseId}/prerequisites`, {
    method: 'PUT',
    body: JSON.stringify({ requiredCourseIds }),
  })
}

function getPrerequisites(courseId: string) {
  return admin(`/api/admin/courses/${courseId}/prerequisites`)
}

describe('FV-17 Lehrgangs-Voraussetzungen – Pflege', () => {
  it('AC-13: weist Unangemeldete mit 401 und Mitglieder mit 403 ab', async () => {
    const course = await createCourse(adminCookie, { title: 'Voraussetzungen Autorisierung' })

    expect((await admin(`/api/admin/courses/${course.id}/prerequisites`, {}, null)).status).toBe(401)
    expect((await admin(`/api/admin/courses/${course.id}/prerequisites`, {}, memberCookie)).status).toBe(403)
    expect(
      (await admin(
        `/api/admin/courses/${course.id}/prerequisites`,
        { method: 'PUT', body: JSON.stringify({ requiredCourseIds: [] }) },
        memberCookie,
      )).status,
    ).toBe(403)
  })

  it('AC-6: liefert neu angelegte Lehrgänge zunächst ohne Voraussetzungen', async () => {
    const course = await createCourse(adminCookie, { title: 'Ohne Voraussetzung' })

    const response = await getPrerequisites(course.id)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [] })
  })

  it('AC-6: liefert die Voraussetzungen als Liste von { id, title }', async () => {
    const required = await createCourse(adminCookie, { title: 'Sichtbare Voraussetzung' })
    const course = await createCourse(adminCookie, { title: 'Mit Anzeige' })

    await putPrerequisites(course.id, [required.id])

    const data = await (await getPrerequisites(course.id)).json()
    expect(data.items).toEqual([{ id: required.id, title: 'Sichtbare Voraussetzung' }])
  })

  it('AC-1: doppelte Voraussetzungs-IDs in der Liste erzeugen nur eine Kante', async () => {
    const required = await createCourse(adminCookie, { title: 'Doppelt genannt' })
    const course = await createCourse(adminCookie, { title: 'Mit Dublette' })

    const response = await putPrerequisites(course.id, [required.id, required.id])
    expect(response.status).toBe(200)

    const data = await (await getPrerequisites(course.id)).json()
    expect(data.items).toHaveLength(1)
  })

  it('AC-2: ein Lehrgang kann sich nicht selbst als Voraussetzung haben', async () => {
    const course = await createCourse(adminCookie, { title: 'Selbstbezug' })

    const response = await putPrerequisites(course.id, [course.id])
    expect(response.status).toBe(422)

    const data = await (await getPrerequisites(course.id)).json()
    expect(data.items).toEqual([])
  })

  it('AC-3: ersetzt die komplette Voraussetzungsmenge, eine leere Liste entfernt alle', async () => {
    const reqA = await createCourse(adminCookie, { title: 'Voraussetzung A' })
    const reqB = await createCourse(adminCookie, { title: 'Voraussetzung B' })
    const course = await createCourse(adminCookie, { title: 'Hauptlehrgang' })

    await putPrerequisites(course.id, [reqA.id])
    let data = await (await getPrerequisites(course.id)).json()
    expect(data.items.map((item: { id: string }) => item.id)).toEqual([reqA.id])

    const replaced = await putPrerequisites(course.id, [reqB.id])
    expect(replaced.status).toBe(200)
    data = await (await getPrerequisites(course.id)).json()
    expect(data.items.map((item: { id: string }) => item.id)).toEqual([reqB.id])

    const cleared = await putPrerequisites(course.id, [])
    expect(cleared.status).toBe(200)
    data = await (await getPrerequisites(course.id)).json()
    expect(data.items).toEqual([])
  })

  it('AC-4: eine unbekannte Lehrgangs-ID in der Liste ergibt 404 und ändert nichts', async () => {
    const known = await createCourse(adminCookie, { title: 'Bekannte Voraussetzung' })
    const course = await createCourse(adminCookie, { title: 'Mit unbekannter Voraussetzung' })
    await putPrerequisites(course.id, [known.id])

    const response = await putPrerequisites(course.id, ['gibt-es-nicht'])
    expect(response.status).toBe(404)

    const data = await (await getPrerequisites(course.id)).json()
    expect(data.items.map((item: { id: string }) => item.id)).toEqual([known.id])
  })

  it('AC-5: ein direkter Zyklus wird abgelehnt und ändert nichts (A→B, B soll A verlangen)', async () => {
    const a = await createCourse(adminCookie, { title: 'Zyklus A' })
    const b = await createCourse(adminCookie, { title: 'Zyklus B' })

    await putPrerequisites(a.id, [b.id])

    const response = await putPrerequisites(b.id, [a.id])
    expect(response.status).toBe(422)

    const data = await (await getPrerequisites(b.id)).json()
    expect(data.items).toEqual([])
  })

  it('AC-5: ein Zyklus über drei Stationen wird erkannt (A→B→C, C soll A verlangen)', async () => {
    const a = await createCourse(adminCookie, { title: 'Kette A' })
    const b = await createCourse(adminCookie, { title: 'Kette B' })
    const c = await createCourse(adminCookie, { title: 'Kette C' })

    await putPrerequisites(a.id, [b.id])
    await putPrerequisites(b.id, [c.id])

    const response = await putPrerequisites(c.id, [a.id])
    expect(response.status).toBe(422)

    const data = await (await getPrerequisites(c.id)).json()
    expect(data.items).toEqual([])
  })

  // AC-7 (Wortlaut zum Zeitpunkt von FV-17): „der öffentliche Katalog bleibt unverändert –
  // Voraussetzungen filtern nichts". Das galt, solange FV-20 nicht existierte (siehe Tech
  // Design/Nicht-Teil-dieser-Spec dort). FV-20 wertet Voraussetzungen jetzt aus und blendet
  // einen Lehrgang für ein Mitglied ohne erfüllte Voraussetzung aus – siehe
  // `features/FV-20-katalog-sichtbarkeit.md`, Abschnitt „Abweichung von der ursprünglichen
  // Spec". Was von AC-7 unveraendert bleibt: das reine *Setzen* einer Voraussetzung
  // (dieser PUT-Endpunkt) loest selbst keine Filterung aus und der Admin-Katalog bleibt
  // ungefiltert – die Sichtbarkeitsauswertung sitzt vollstaendig in FV-20s eigenem Service.
  it('AC-7: das Setzen einer Voraussetzung filtert den Katalog nicht selbst – die Sichtbarkeitsauswertung sitzt in FV-20', async () => {
    const required = await createCourse(adminCookie, { title: 'Nötige Voraussetzung' })
    const course = await createCourse(adminCookie, { title: 'Sichtbar trotz Voraussetzung' })
    await putPrerequisites(course.id, [required.id])

    const adminList = await (
      await fetch(`/api/courses?q=${encodeURIComponent(course.title)}`, { headers: { cookie: adminCookie } })
    ).json()
    expect(adminList.items.map((item: { id: string }) => item.id)).toContain(course.id)

    const memberList = await (
      await fetch(`/api/courses?q=${encodeURIComponent(course.title)}`, { headers: { cookie: memberCookie } })
    ).json()
    expect(memberList.items.map((item: { id: string }) => item.id)).not.toContain(course.id)
  })
})
