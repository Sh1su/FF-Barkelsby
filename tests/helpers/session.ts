import { fetch } from '@nuxt/test-utils/e2e'

/**
 * Meldet ein Konto an und liefert den Cookie-Header fuer Folgeanfragen.
 *
 * Die Seed-Konten starten mit erzwungenem Passwortwechsel (FV-1, AC-10). Der Helfer
 * erledigt den Wechsel einmalig und ist bewusst idempotent, damit die Testdateien in
 * beliebiger Reihenfolge laufen koennen.
 */
const ACCOUNTS = {
  guest: {
    email: 'gast@test.local',
    startPassword: 'start-gast-passwort',
    password: 'test-gast-passwort-2026',
  },
  admin: {
    email: 'wehrfuehrung@test.local',
    startPassword: 'start-admin-passwort',
    password: 'test-admin-passwort-2026',
  },
} as const

export type TestRole = keyof typeof ACCOUNTS

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map(cookie => cookie.split(';')[0])
    .join('; ')
}

async function login(email: string, password: string, ip: string) {
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })
}

export async function signIn(role: TestRole, ip = '127.0.0.99'): Promise<string> {
  const account = ACCOUNTS[role]

  const withCurrent = await login(account.email, account.password, ip)
  if (withCurrent.status === 200) return cookieHeader(withCurrent)

  const withStart = await login(account.email, account.startPassword, ip)
  if (withStart.status !== 200) {
    throw new Error(`Anmeldung als ${role} fehlgeschlagen (${withStart.status})`)
  }

  const cookie = cookieHeader(withStart)
  const changed = await fetch('/api/auth/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      currentPassword: account.startPassword,
      newPassword: account.password,
    }),
    redirect: 'manual',
  })

  if (changed.status !== 200) {
    throw new Error(`Passwortwechsel für ${role} fehlgeschlagen (${changed.status})`)
  }

  return cookieHeader(changed)
}

export { ACCOUNTS }
