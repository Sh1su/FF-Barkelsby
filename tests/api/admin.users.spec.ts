import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { ACCOUNTS, signIn } from '../helpers/session'

await startTestServer('admin-users')

let adminCookie: string
let guestCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.12.1')
  guestCookie = await signIn('guest', '127.0.12.2')
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

async function konten() {
  const response = await admin('/api/admin/users?limit=100')
  return (await response.json()).items as {
    id: string
    email: string
    role: string
    active: boolean
    mustChangePassword: boolean
  }[]
}

async function legeAdminAn(email: string, password = 'ein-langes-startpasswort') {
  const response = await admin('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, displayName: 'Vertretung', password }),
  })
  return { status: response.status, konto: await response.json() }
}

describe('FV-7 Benutzerverwaltung – Liste und Anlegen', () => {
  it('AC-11: nur Admins sehen und ändern Konten', async () => {
    expect((await admin('/api/admin/users', {}, null)).status).toBe(401)
    expect((await admin('/api/admin/users', {}, guestCookie)).status).toBe(403)
  })

  it('AC-1/AC-10: die Liste zeigt Kennung, Rolle und Zustand – aber keine Hashes', async () => {
    const liste = await konten()

    expect(liste.length).toBeGreaterThanOrEqual(2)
    expect(liste.some(konto => konto.role === 'guest')).toBe(true)
    expect(liste.some(konto => konto.role === 'admin')).toBe(true)
    expect(JSON.stringify(liste)).not.toContain('scrypt$')
    expect(JSON.stringify(liste)).not.toContain('passwordHash')
  })

  it('AC-2/AC-12: ein neues Admin-Konto startet mit erzwungenem Passwortwechsel', async () => {
    const { status, konto } = await legeAdminAn('vertretung@test.local')

    expect(status).toBe(201)
    expect(konto).toMatchObject({ role: 'admin', active: true, mustChangePassword: true })
  })

  it('AC-8: eine bereits vergebene Kennung wird abgelehnt', async () => {
    await legeAdminAn('doppelt@test.local')
    const zweiter = await legeAdminAn('doppelt@test.local')

    expect(zweiter.status).toBe(409)
  })

  it('AC-8: Groß- und Kleinschreibung zählt als dieselbe Kennung', async () => {
    await legeAdminAn('gross@test.local')
    const zweiter = await legeAdminAn('Gross@Test.Local')

    expect(zweiter.status).toBe(409)
  })

  it('AC-10: ein zu kurzes Startpasswort wird mit 400 abgelehnt', async () => {
    const { status } = await legeAdminAn('kurz@test.local', 'kurz')

    expect(status).toBe(400)
  })

  it('AC-2: die Rolle lässt sich nicht über den Request umbiegen', async () => {
    const response = await admin('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'rollenversuch@test.local',
        displayName: 'Versuch',
        password: 'ein-langes-startpasswort',
        role: 'guest',
      }),
    })

    expect((await response.json()).role).toBe('admin')
  })
})

describe('FV-7 Benutzerverwaltung – Ändern', () => {
  it('AC-3: das Gast-Passwort lässt sich setzen und gilt sofort', async () => {
    const gast = (await konten()).find(konto => konto.role === 'guest')!

    const response = await admin(`/api/admin/users/${gast.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password: 'neues-gast-passwort-2026' }),
    })
    expect(response.status).toBe(200)

    // Anmeldung mit dem neuen Passwort klappt, mit dem alten nicht mehr.
    const neu = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.12.10' },
      body: JSON.stringify({ email: gast.email, password: 'neues-gast-passwort-2026' }),
      redirect: 'manual',
    })
    expect(neu.status).toBe(200)

    const alt = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.12.11' },
      body: JSON.stringify({ email: gast.email, password: 'test-gast-passwort-2026' }),
      redirect: 'manual',
    })
    expect(alt.status).toBe(401)
  })

  it('AC-4: die Kennung des Gast-Zugangs lässt sich ändern', async () => {
    const gast = (await konten()).find(konto => konto.role === 'guest')!

    const response = await admin(`/api/admin/users/${gast.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ email: 'neuer-gast@test.local' }),
    })

    expect(response.status).toBe(200)
    expect((await response.json()).email).toBe('neuer-gast@test.local')
  })

  it('AC-7: der Gast-Zugang lässt sich nicht deaktivieren', async () => {
    const gast = (await konten()).find(konto => konto.role === 'guest')!

    const response = await admin(`/api/admin/users/${gast.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    })

    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toContain('Gast-Zugang')
  })

  it('AC-5/AC-9: ein deaktiviertes Konto kommt nicht mehr herein', async () => {
    await legeAdminAn('zumdeaktivieren@test.local', 'startpasswort-fuer-test')
    const konto = (await konten()).find(eintrag => eintrag.email === 'zumdeaktivieren@test.local')!

    // Erst anmelden, dann deaktivieren: die laufende Sitzung muss sofort ungültig werden.
    const anmeldung = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.12.12' },
      body: JSON.stringify({ email: 'zumdeaktivieren@test.local', password: 'startpasswort-fuer-test' }),
      redirect: 'manual',
    })
    expect(anmeldung.status).toBe(200)

    const sitzung = anmeldung.headers.getSetCookie().map(eintrag => eintrag.split(';')[0]).join('; ')

    await admin(`/api/admin/users/${konto.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    })

    // Laufende Sitzung: sofort ungültig.
    const mitAlterSitzung = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: sitzung },
      body: JSON.stringify({ currentPassword: 'x', newPassword: 'ein-langes-neues-passwort' }),
      redirect: 'manual',
    })
    expect(mitAlterSitzung.status).toBe(401)

    // Neue Anmeldung: ebenfalls abgelehnt.
    const erneut = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.12.13' },
      body: JSON.stringify({ email: 'zumdeaktivieren@test.local', password: 'startpasswort-fuer-test' }),
      redirect: 'manual',
    })
    expect(erneut.status).toBe(401)
  })

  it('AC-5: ein deaktiviertes Konto lässt sich wieder aktivieren', async () => {
    const konto = (await konten()).find(eintrag => eintrag.email === 'zumdeaktivieren@test.local')!

    const response = await admin(`/api/admin/users/${konto.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: true }),
    })

    expect(response.status).toBe(200)
    expect((await response.json()).active).toBe(true)
  })

  it('AC-6: der letzte aktive Admin kann sich nicht selbst deaktivieren', async () => {
    // Alle anderen Admins deaktivieren – uebrig bleibt das Konto dieser Testsitzung.
    // Bewusst nicht das eigene Konto zuerst: es wuerde die laufende Sitzung sofort
    // ungueltig machen (AC-9) und die folgenden Aufrufe liefen in ein 401.
    const andere = (await konten()).filter(
      konto => konto.role === 'admin' && konto.active && konto.email !== ACCOUNTS.admin.email,
    )
    for (const konto of andere) {
      const abgeschaltet = await admin(`/api/admin/users/${konto.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: false }),
      })
      expect(abgeschaltet.status).toBe(200)
    }

    const letzter = (await konten()).find(konto => konto.email === ACCOUNTS.admin.email)!
    const response = await admin(`/api/admin/users/${letzter.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    })

    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toContain('letzte aktive Verwaltungskonto')
  })

  it('AC-12: wer sein eigenes Passwort setzt, muss es nicht erneut wechseln', async () => {
    // QA-Befund BUG-7-4: der Zwangswechsel gilt nur fuer fremde Konten – das eigene
    // Passwort hat man sich selbst ausgedacht.
    const selbst = (await konten()).find(konto => konto.email === ACCOUNTS.admin.email)!

    const response = await admin(`/api/admin/users/${selbst.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password: 'mein-eigenes-langes-passwort' }),
    })

    expect(response.status).toBe(200)
    expect((await response.json()).mustChangePassword).toBe(false)

    const angemeldet = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.12.20' },
      body: JSON.stringify({
        email: ACCOUNTS.admin.email,
        password: 'mein-eigenes-langes-passwort',
      }),
      redirect: 'manual',
    })

    expect(angemeldet.status).toBe(200)
    expect((await angemeldet.json()).mustChangePassword).toBe(false)
  })

  it('AC-12: ein unbekanntes Konto führt zu 404, ein leerer Rumpf zu 400', async () => {
    expect((await admin('/api/admin/users/gibt-es-nicht', {
      method: 'PATCH',
      body: JSON.stringify({ active: true }),
    })).status).toBe(404)

    const letzter = (await konten()).find(konto => konto.role === 'admin' && konto.active)!
    expect((await admin(`/api/admin/users/${letzter.id}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })).status).toBe(400)
  })
})

describe('FV-7 Benutzerverwaltung – Nachbesserungen aus der QA', () => {
  it('AC-1: die Liste ist seitenweise und hat ein hartes Limit', async () => {
    // QA-Befund BUG-7-5 (.claude/rules/backend.md: Default 25, Max 100).
    const ohneAngabe = await (await admin('/api/admin/users')).json()
    expect(ohneAngabe).toMatchObject({ page: 1, limit: 25 })
    expect(ohneAngabe.total).toBeGreaterThanOrEqual(ohneAngabe.items.length)

    const ersteSeite = await (await admin('/api/admin/users?limit=1&page=1')).json()
    const zweiteSeite = await (await admin('/api/admin/users?limit=1&page=2')).json()
    expect(ersteSeite.items).toHaveLength(1)
    expect(zweiteSeite.items).toHaveLength(1)
    expect(ersteSeite.items[0].id).not.toBe(zweiteSeite.items[0].id)

    expect((await admin('/api/admin/users?limit=101')).status).toBe(400)
  })

  it('AC-9: nach dem Deaktivieren meldet auch der Session-Endpunkt kein Konto mehr', async () => {
    // QA-Befund BUG-7-3: /api/_auth/session ist oeffentlich und lieferte die Sitzung eines
    // deaktivierten Kontos weiter aus – die Oberflaeche wirkte angemeldet.
    await legeAdminAn('sitzungspruefung@test.local', 'startpasswort-fuer-test')

    const anmeldung = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.12.21' },
      body: JSON.stringify({
        email: 'sitzungspruefung@test.local',
        password: 'startpasswort-fuer-test',
      }),
      redirect: 'manual',
    })
    const sitzung = anmeldung.headers.getSetCookie().map(eintrag => eintrag.split(';')[0]).join('; ')

    const vorher = await (await fetch('/api/_auth/session', { headers: { cookie: sitzung } })).json()
    expect(vorher.user?.email).toBe('sitzungspruefung@test.local')

    const konto = (await konten()).find(eintrag => eintrag.email === 'sitzungspruefung@test.local')!
    expect((await admin(`/api/admin/users/${konto.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    })).status).toBe(200)

    const nachher = await (await fetch('/api/_auth/session', { headers: { cookie: sitzung } })).json()
    expect(nachher.user).toBeUndefined()
  })
})
