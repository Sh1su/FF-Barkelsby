import { describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { SESSION_MAX_AGE_SECONDS } from '../../shared/constants'
import { signIn } from '../helpers/session'

await startTestServer('auth-session')

function get(path: string, cookie?: string) {
  return fetch(path, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  })
}

describe('FV-1 Fundament & Login-Gate – Session', () => {
  it('AC-14: der Healthcheck ist ohne Anmeldung erreichbar', async () => {
    const response = await get('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('AC-1: geschützte API-Routen antworten ohne Session mit 401', async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST', redirect: 'manual' })

    expect(response.status).toBe(401)
  })

  it('AC-8: die Gast-Session läuft nach 30 Tagen ab', async () => {
    const cookie = await signIn('guest', '127.0.0.21')
    const session = await (await get('/api/_auth/session', cookie)).json()

    const lifetimeSeconds = (session.expiresAt - Date.now()) / 1000
    expect(lifetimeSeconds).toBeGreaterThan(SESSION_MAX_AGE_SECONDS.guest - 120)
    expect(lifetimeSeconds).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS.guest)
  })

  it('AC-8: die Admin-Session läuft nach 8 Stunden ab', async () => {
    const cookie = await signIn('admin', '127.0.0.22')
    const session = await (await get('/api/_auth/session', cookie)).json()

    const lifetimeSeconds = (session.expiresAt - Date.now()) / 1000
    expect(lifetimeSeconds).toBeGreaterThan(SESSION_MAX_AGE_SECONDS.admin - 120)
    expect(lifetimeSeconds).toBeLessThanOrEqual(SESSION_MAX_AGE_SECONDS.admin)
  })

  it('AC-7: die Session enthält keinen Passwort-Hash', async () => {
    const cookie = await signIn('guest', '127.0.0.23')
    const session = await (await get('/api/_auth/session', cookie)).json()

    expect(JSON.stringify(session)).not.toContain('scrypt$')
    expect(session.user).not.toHaveProperty('passwordHash')
  })

  it('AC-12: Abmelden verwirft die Session', async () => {
    const cookie = await signIn('guest', '127.0.0.24')

    const loggedOut = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
      redirect: 'manual',
    })
    expect(loggedOut.status).toBe(200)

    const session = await (await get('/api/_auth/session', cookie)).json()
    expect(session.user).toBeUndefined()
  })

  it('AC-13: ein zu kurzes neues Passwort wird mit 400 abgelehnt', async () => {
    const cookie = await signIn('admin', '127.0.0.25')

    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ currentPassword: 'test-admin-passwort-2026', newPassword: 'kurz' }),
      redirect: 'manual',
    })

    expect(response.status).toBe(400)
  })

  it('AC-13: ein falsches aktuelles Passwort wird mit 400 abgelehnt', async () => {
    const cookie = await signIn('admin', '127.0.0.26')

    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        currentPassword: 'ganz-sicher-falsch',
        newPassword: 'ein-neues-langes-passwort',
      }),
      redirect: 'manual',
    })

    expect(response.status).toBe(400)
  })
})
