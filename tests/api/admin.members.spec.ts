import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { PASSWORD_MIN_LENGTH } from '../../shared/constants'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'

await startTestServer('admin-members')

let adminCookie: string
let memberCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.13.1')
  memberCookie = await signIn('member', '127.0.13.2')
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

function legeMitgliedAn(body: Record<string, unknown>, cookie: string | null = adminCookie) {
  return admin('/api/admin/members', { method: 'POST', body: JSON.stringify(body) }, cookie)
}

describe('FV-16 Mitgliedskonten anlegen', () => {
  it('AC-1: nur Admins duerfen ein Mitgliedskonto anlegen', async () => {
    const body = { email: 'ohne-berechtigung@test.local', displayName: 'Versuch' }

    expect((await legeMitgliedAn(body, null)).status).toBe(401)
    expect((await legeMitgliedAn(body, memberCookie)).status).toBe(403)
  })

  it('AC-1: legt ein Konto mit Rolle member an, unabhaengig vom Request-Body', async () => {
    const response = await legeMitgliedAn({
      email: 'neues-mitglied@test.local',
      displayName: 'Neues Mitglied',
      role: 'admin',
    })

    expect(response.status).toBe(201)
    const konto = await response.json()
    expect(konto).toMatchObject({ role: 'member', active: true, mustChangePassword: true })
  })

  it('AC-2: ohne eigenes Passwort erzeugt der Server eines und gibt es einmalig zurück', async () => {
    const response = await legeMitgliedAn({
      email: 'ohne-passwort@test.local',
      displayName: 'Ohne Passwort',
    })

    expect(response.status).toBe(201)
    const konto = await response.json()
    expect(typeof konto.generatedPassword).toBe('string')
    expect(konto.generatedPassword.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH)

    // Das erzeugte Passwort gilt sofort.
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.13.10' },
      body: JSON.stringify({ email: 'ohne-passwort@test.local', password: konto.generatedPassword }),
      redirect: 'manual',
    })
    expect(login.status).toBe(200)
  })

  it('AC-2: zwei Anlagen ohne eigenes Passwort erzeugen unterschiedliche Startpasswörter', async () => {
    const erstes = await (await legeMitgliedAn({
      email: 'zufall-eins@test.local',
      displayName: 'Zufall Eins',
    })).json()
    const zweites = await (await legeMitgliedAn({
      email: 'zufall-zwei@test.local',
      displayName: 'Zufall Zwei',
    })).json()

    expect(erstes.generatedPassword).not.toBe(zweites.generatedPassword)
  })

  it('AC-2: mit eigenem Passwort enthält die Antwort kein generatedPassword', async () => {
    const response = await legeMitgliedAn({
      email: 'eigenes-passwort@test.local',
      displayName: 'Eigenes Passwort',
      password: 'ein-ausreichend-langes-passwort',
    })

    expect(response.status).toBe(201)
    const konto = await response.json()
    expect(konto.generatedPassword).toBeUndefined()
  })

  it('AC-2: ein zu kurzes eigenes Passwort wird mit 400 abgelehnt', async () => {
    const response = await legeMitgliedAn({
      email: 'zu-kurz@test.local',
      displayName: 'Zu Kurz',
      password: 'kurz',
    })

    expect(response.status).toBe(400)
  })

  it('AC-3: das neue Konto muss beim ersten Anmelden das Passwort wechseln', async () => {
    const konto = await (await legeMitgliedAn({
      email: 'wechsel-pflicht@test.local',
      displayName: 'Wechsel Pflicht',
    })).json()

    expect(konto.mustChangePassword).toBe(true)
  })

  it('AC-4: eine bereits vergebene Kennung wird mit 409 abgelehnt', async () => {
    await legeMitgliedAn({ email: 'doppelt-mitglied@test.local', displayName: 'Erstes' })
    const zweiter = await legeMitgliedAn({ email: 'doppelt-mitglied@test.local', displayName: 'Zweites' })

    expect(zweiter.status).toBe(409)
  })
})
