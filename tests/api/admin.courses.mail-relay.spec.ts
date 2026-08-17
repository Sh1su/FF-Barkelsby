import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'
import { insertSignup } from '../factories/signup'

/**
 * Dieser Server ist auf ein Relay konfiguriert, das es nicht gibt (Port 2525, nichts lauscht).
 * Damit lassen sich der Fehlerpfad und das Zeitverhalten pruefen, ohne echte Mails zu senden.
 */
await startTestServer('admin-courses-mail-relay', {
  NUXT_SMTP_HOST: '127.0.0.1',
  NUXT_SMTP_PORT: '2525',
  NUXT_SMTP_FROM: 'lehrgaenge@test.local',
})

const DB = 'admin-courses-mail-relay'
let adminCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.7.1')
})

function admin(path: string, init: RequestInit = {}) {
  return fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: adminCookie, ...(init.headers ?? {}) },
    redirect: 'manual',
  })
}

describe('FV-4 E-Mail-Infrastruktur – nicht erreichbares Relay', () => {
  it('AC-3: der Versand scheitert, die Absage bleibt trotzdem gesetzt', async () => {
    const course = await createCourse(adminCookie, { title: 'Relay kaputt' })
    insertSignup(DB, course.id, 'offen', 'empfaenger@test.local')

    const response = await admin(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled: true }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'abgesagt' })

    const mails = (await (await admin(`/api/admin/courses/${course.id}/mails`)).json()).items
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ status: 'fehlgeschlagen', sentAt: null })
    expect(mails[0].error).toBeTruthy()
  })

  it('AC-9: der Fehlertext enthält keine Zugangsdaten', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'zweiter@test.local')

    await admin(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled: true }),
    })

    const mails = (await (await admin(`/api/admin/courses/${course.id}/mails`)).json()).items
    expect(mails[0].error).not.toContain('lehrgaenge@test.local')
    expect(JSON.stringify(mails[0])).not.toMatch(/passwor|password|token/i)
  })

  it('AC-10: das Absagen antwortet trotz totem Relay in normaler Zeit', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'dritter@test.local')

    const start = Date.now()
    const response = await admin(`/api/admin/courses/${course.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelled: true }),
    })
    const dauer = Date.now() - start

    expect(response.status).toBe(200)
    expect(dauer).toBeLessThan(15_000)
  })
})
