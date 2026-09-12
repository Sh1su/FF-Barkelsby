import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'

await startTestServer('eligibility')

/**
 * FV-20 Voraussetzungs-Engine – Sichtbarkeitsregel end-to-end ueber die Katalog-Detailseite
 * (`GET /api/courses/:id`), nicht als reiner Unit-Test gegen `eligibility.service.ts` direkt:
 * dessen Funktionen rufen (wie jeder andere Service in diesem Projekt) das global
 * auto-importierte `useDatabase()` auf, das ausserhalb eines laufenden Nitro-Servers nicht
 * aufgeloest werden kann – das `unit`-Vitest-Projekt startet bewusst keinen Nitro (siehe
 * `vitest.config.ts`, "kein Nuxt, kein HTTP"). Siehe „Abweichung von der ursprünglichen Spec“ in
 * `features/FV-20-katalog-sichtbarkeit.md`.
 */

let adminCookie: string
let memberCookie: string
let memberId: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.20.1')
  memberCookie = await signIn('member', '127.0.20.2')

  const session = await (await fetch('/api/_auth/session', { headers: { cookie: memberCookie } })).json()
  memberId = session.user.id
})

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

function detail(courseId: string, cookie = memberCookie) {
  return fetch(`/api/courses/${courseId}`, { headers: { cookie }, redirect: 'manual' })
}

describe('FV-20 Voraussetzungs-Engine & Katalog-Sichtbarkeit – Sichtbarkeitsregel', () => {
  it('AC-1: eine einzelne, erfüllte Voraussetzung macht den Lehrgang für das Mitglied sichtbar', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Eligibility Voraussetzung' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Eligibility Erfüllt' })
    await putPrerequisites(course.id, [required.id])
    await trageAbschlussEin(required.id)

    expect((await detail(course.id)).status).toBe(200)
  })

  it('AC-1: eine unerfüllte Voraussetzung verweigert dem Mitglied den Zugriff', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Eligibility Voraussetzung Zwei' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Eligibility Unerfüllt' })
    await putPrerequisites(course.id, [required.id])

    expect((await detail(course.id)).status).toBe(404)
  })

  it('AC-2: ein selbst abgeschlossener Lehrgang bleibt sichtbar, auch wenn seine eigene Voraussetzung offen ist', async () => {
    const required = await createCourse(adminCookie, { title: 'FV-20 Eligibility Nachträglich' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Eligibility Bereits Abgeschlossen' })
    await putPrerequisites(course.id, [required.id])
    // Lehrgang selbst abgeschlossen – die Voraussetzung dafür bleibt bewusst offen.
    await trageAbschlussEin(course.id)

    expect((await detail(course.id)).status).toBe(200)
  })

  it('AC-6: ein Lehrgang ganz ohne Voraussetzung ist für jedes Mitglied automatisch berechtigt', async () => {
    const course = await createCourse(adminCookie, { title: 'FV-20 Eligibility Ohne Voraussetzung' })

    expect((await detail(course.id)).status).toBe(200)
  })

  it('Edge Case (FV-20): zwei Voraussetzungen, nur eine erfüllt – UND-Verknüpfung verweigert den Zugriff', async () => {
    const reqA = await createCourse(adminCookie, { title: 'FV-20 Eligibility UND A' })
    const reqB = await createCourse(adminCookie, { title: 'FV-20 Eligibility UND B' })
    const course = await createCourse(adminCookie, { title: 'FV-20 Eligibility UND Ziel' })
    await putPrerequisites(course.id, [reqA.id, reqB.id])
    await trageAbschlussEin(reqA.id)

    expect((await detail(course.id)).status).toBe(404)

    await trageAbschlussEin(reqB.id)
    expect((await detail(course.id)).status).toBe(200)
  })
})
