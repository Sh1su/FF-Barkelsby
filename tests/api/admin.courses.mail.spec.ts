import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse, isoInDays } from '../factories/course'
import { insertSignup } from '../factories/signup'

/**
 * Dieser Server läuft OHNE SMTP-Konfiguration – der Regelfall beim ersten Aufsetzen.
 * Der Fehlerpfad mit einem nicht erreichbaren Relay steht in admin.courses.mail-relay.spec.ts.
 */
await startTestServer('admin-courses-mail')

const DB = 'admin-courses-mail'
let adminCookie: string
let guestCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.6.1')
  guestCookie = await signIn('guest', '127.0.6.2')
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

async function mailsOf(courseId: string) {
  const response = await admin(`/api/admin/courses/${courseId}/mails`)
  return (await response.json()).items as {
    recipient: string
    template: string
    subject: string
    status: string
    error: string | null
    sentAt: string | null
  }[]
}

async function cancel(courseId: string, cancelled = true) {
  return admin(`/api/admin/courses/${courseId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancelled }),
  })
}

describe('FV-4 E-Mail-Infrastruktur – Absage', () => {
  it('AC-8: das Mailprotokoll ist nur für Admins lesbar', async () => {
    const course = await createCourse(adminCookie)

    expect((await admin(`/api/admin/courses/${course.id}/mails`, {}, null)).status).toBe(401)
    expect((await admin(`/api/admin/courses/${course.id}/mails`, {}, guestCookie)).status).toBe(403)
  })

  it('AC-1: ohne SMTP-Konfiguration wird protokolliert statt versendet', async () => {
    const course = await createCourse(adminCookie, { title: 'Absage ohne Relay' })
    insertSignup(DB, course.id, 'offen', 'offen@test.local')

    const response = await cancel(course.id)
    expect(response.status).toBe(200)

    const mails = await mailsOf(course.id)
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({
      recipient: 'offen@test.local',
      template: 'lehrgang-abgesagt',
      status: 'nicht_versendet',
      sentAt: null,
    })
    expect(mails[0]!.subject).toContain('Absage ohne Relay')
  })

  it('AC-5: nur offene und bestätigte Anmeldungen bekommen Post', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'offen2@test.local')
    insertSignup(DB, course.id, 'bestaetigt', 'bestaetigt@test.local')
    insertSignup(DB, course.id, 'abgelehnt', 'abgelehnt@test.local')
    insertSignup(DB, course.id, 'storniert', 'storniert@test.local')

    await cancel(course.id)

    const empfaenger = (await mailsOf(course.id)).map(mail => mail.recipient).sort()
    expect(empfaenger).toEqual(['bestaetigt@test.local', 'offen2@test.local'])
  })

  it('AC-7: jeder Empfänger bekommt eine eigene Nachricht', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'a@test.local')
    insertSignup(DB, course.id, 'offen', 'b@test.local')
    insertSignup(DB, course.id, 'offen', 'c@test.local')

    await cancel(course.id)

    const mails = await mailsOf(course.id)
    expect(mails).toHaveLength(3)
    for (const mail of mails) {
      expect(mail.recipient).not.toContain(',')
      expect(mail.recipient).not.toContain(';')
    }
  })

  it('AC-5: ein Lehrgang ohne Interessenten löst keine Mail aus', async () => {
    const course = await createCourse(adminCookie)

    await cancel(course.id)

    expect(await mailsOf(course.id)).toEqual([])
  })

  it('Edge Case: eine zweite Absage erzeugt keine zweite Mail', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'doppelt@test.local')

    await cancel(course.id)
    await cancel(course.id)

    expect(await mailsOf(course.id)).toHaveLength(1)
  })

  it('Edge Case: das Zurücknehmen der Absage benachrichtigt niemanden', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'zurueck@test.local')

    await cancel(course.id)
    await cancel(course.id, false)

    const mails = await mailsOf(course.id)
    expect(mails).toHaveLength(1)
    expect(mails[0]!.template).toBe('lehrgang-abgesagt')
  })
})

describe('FV-4 E-Mail-Infrastruktur – Terminänderung', () => {
  it('AC-6: eine Verschiebung benachrichtigt die Interessenten', async () => {
    const course = await createCourse(adminCookie, { title: 'Wird verschoben' })
    insertSignup(DB, course.id, 'bestaetigt', 'verschoben@test.local')

    const response = await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ startsOn: isoInDays(40), endsOn: isoInDays(41) }),
    })
    expect(response.status).toBe(200)

    const mails = await mailsOf(course.id)
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({
      recipient: 'verschoben@test.local',
      template: 'lehrgang-verschoben',
    })
    expect(mails[0]!.subject).toContain('Neuer Termin')
  })

  it('AC-6: andere Änderungen lösen keine Mail aus', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'unveraendert@test.local')

    await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'Neuer Beschreibungstext',
        capacity: 30,
        summary: 'Neue Kurzbeschreibung',
      }),
    })

    expect(await mailsOf(course.id)).toEqual([])
  })

  it('AC-6: ein abgesagter Lehrgang löst bei Terminpflege keine Verschiebungsmail aus', async () => {
    const course = await createCourse(adminCookie)
    insertSignup(DB, course.id, 'offen', 'abgesagt-verschoben@test.local')

    await cancel(course.id)
    await admin(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ startsOn: isoInDays(50), endsOn: isoInDays(51) }),
    })

    const templates = (await mailsOf(course.id)).map(mail => mail.template)
    expect(templates).toEqual(['lehrgang-abgesagt'])
  })
})
