import { describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { LOGIN_RATE_LIMIT } from '../../shared/constants'

await startTestServer('auth-login')

const ADMIN = { email: 'wehrfuehrung@test.local', password: 'start-admin-passwort' }
const GUEST = { email: 'gast@test.local', password: 'start-gast-passwort' }

/** Jeder Test bekommt eine eigene Client-IP, damit das Rate Limit die anderen nicht stört. */
function login(body: Record<string, unknown>, ip: string) {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
}

describe('FV-1 Fundament & Login-Gate – Anmeldung', () => {
  it('AC-2: meldet das Gast-Konto an und setzt ein Session-Cookie', async () => {
    const response = await login(GUEST, '10.0.0.1')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ role: 'guest' })
    expect(response.headers.get('set-cookie')).toContain('fireedu-session')
  })

  it('AC-3: meldet das Admin-Konto an', async () => {
    const response = await login(ADMIN, '10.0.0.2')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ role: 'admin' })
  })

  it('AC-4: antwortet bei falschem Passwort generisch mit 401', async () => {
    const response = await login({ ...GUEST, password: 'falsch' }, '10.0.0.3')

    expect(response.status).toBe(401)
    expect((await response.json()).statusMessage).toBe('E-Mail oder Passwort ist falsch.')
  })

  it('AC-4: unterscheidet unbekanntes Konto nicht von falschem Passwort', async () => {
    const unknown = await login({ email: 'niemand@test.local', password: 'falsch' }, '10.0.0.4')
    const wrongPassword = await login({ ...GUEST, password: 'auch-falsch' }, '10.0.0.5')

    expect(unknown.status).toBe(wrongPassword.status)
    expect((await unknown.json()).statusMessage).toBe((await wrongPassword.json()).statusMessage)
  })

  it('AC-2: validiert leere Eingaben mit 400', async () => {
    const response = await login({ email: '', password: '' }, '10.0.0.6')

    expect(response.status).toBe(400)
  })

  it('AC-5: sperrt ab dem elften Fehlversuch derselben IP mit 429', async () => {
    const ip = '10.0.0.7'

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      const response = await login({ ...GUEST, password: 'falsch' }, ip)
      expect(response.status).toBe(401)
    }

    const blocked = await login({ ...GUEST, password: 'falsch' }, ip)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('AC-6: sperrt das Konto selbst nie – von einer anderen IP klappt die Anmeldung weiter', async () => {
    const ip = '10.0.0.8'

    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      await login({ ...GUEST, password: 'falsch' }, ip)
    }
    expect((await login(GUEST, ip)).status).toBe(429)

    const fromElsewhere = await login(GUEST, '10.0.0.9')
    expect(fromElsewhere.status).toBe(200)
  })

  it('AC-5: ein erfolgreicher Login setzt den Zähler zurück', async () => {
    const ip = '10.0.0.10'

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts - 1; attempt++) {
      await login({ ...GUEST, password: 'falsch' }, ip)
    }

    expect((await login(GUEST, ip)).status).toBe(200)

    for (let attempt = 0; attempt < LOGIN_RATE_LIMIT.maxAttempts; attempt++) {
      expect((await login({ ...GUEST, password: 'falsch' }, ip)).status).toBe(401)
    }
  })
})
