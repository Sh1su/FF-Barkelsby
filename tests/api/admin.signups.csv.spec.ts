import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'
import { createCourse } from '../factories/course'
import { insertSignup } from '../factories/signup'

await startTestServer('admin-signups-csv')

const DB = 'admin-signups-csv'
let adminCookie: string
let guestCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.11.1')
  guestCookie = await signIn('guest', '127.0.11.2')
})

function csv(courseId: string, cookie: string | null = adminCookie) {
  return fetch(`/api/admin/courses/${courseId}/signups.csv`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  })
}

describe('FV-6 Registratur – CSV-Export', () => {
  it('AC-9: nur Admins dürfen exportieren', async () => {
    const course = await createCourse(adminCookie)

    expect((await csv(course.id, null)).status).toBe(401)
    expect((await csv(course.id, guestCookie)).status).toBe(403)
  })

  it('AC-7: liefert eine Datei mit Kopfzeile und allen nicht stornierten Anmeldungen', async () => {
    const course = await createCourse(adminCookie, { title: 'Atemschutz Übung' })
    insertSignup(DB, course.id, 'bestaetigt', 'dabei@test.local')
    insertSignup(DB, course.id, 'offen', 'wartet@test.local')
    insertSignup(DB, course.id, 'storniert', 'weg@test.local')

    const response = await csv(course.id)
    const inhalt = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toContain('teilnehmer-atemschutz-uebung.csv')

    expect(inhalt).toContain('Nachname;Vorname;E-Mail;Status;Angemeldet am')
    expect(inhalt).toContain('dabei@test.local')
    expect(inhalt).toContain('wartet@test.local')
    expect(inhalt).not.toContain('weg@test.local')
  })

  it('AC-7: beginnt mit einem BOM, damit Excel Umlaute richtig zeigt', async () => {
    const course = await createCourse(adminCookie)

    // Bewusst die rohen Bytes: `Response.text()` entfernt den BOM beim Dekodieren,
    // Excel braucht ihn aber genau dort.
    const bytes = new Uint8Array(await (await csv(course.id)).arrayBuffer())

    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xEF, 0xBB, 0xBF])
  })

  it('AC-7: ein Lehrgang ohne Anmeldungen liefert nur die Kopfzeile', async () => {
    const course = await createCourse(adminCookie)
    const inhalt = await (await csv(course.id)).text()

    expect(inhalt).toBe('Nachname;Vorname;E-Mail;Status;Angemeldet am\r\n')
  })

  it('AC-7: ein unbekannter Lehrgang führt zu 404', async () => {
    expect((await csv('gibt-es-nicht')).status).toBe(404)
  })
})
