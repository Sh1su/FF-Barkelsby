import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from '../helpers/server'
import { signIn } from '../helpers/session'

/**
 * Einstellungen-Seite der Verwaltung: Erscheinungsbild (Name/Kurzname/Logo) und SMTP-Relay.
 * Ersetzt die reine Env-Var-Konfiguration – Details siehe
 * `server/services/branding.service.ts` und `server/services/mail-settings.service.ts`.
 */
await startTestServer('admin-settings')

let adminCookie: string
let memberCookie: string

beforeAll(async () => {
  adminCookie = await signIn('admin', '127.0.9.1')
  memberCookie = await signIn('member', '127.0.9.2')
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

describe('Erscheinungsbild', () => {
  it('GET /api/branding ist öffentlich, auch ohne Anmeldung', async () => {
    const response = await fetch('/api/branding', { redirect: 'manual' })
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('shortName')
    expect(data).toHaveProperty('logoUrl')
  })

  it('weist Gäste und Unangemeldete bei PATCH ab', async () => {
    expect((await admin('/api/admin/settings/branding', { method: 'PATCH', body: '{}' }, null)).status).toBe(401)
    expect((await admin('/api/admin/settings/branding', { method: 'PATCH', body: '{}' }, memberCookie)).status).toBe(403)
  })

  it('speichert Name und Kurzname; die öffentliche Route zeigt sie danach', async () => {
    const response = await admin('/api/admin/settings/branding', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Freiwillige Feuerwehr Testdorf', shortName: 'FT' }),
    })
    expect(response.status).toBe(200)

    const data = await (await fetch('/api/branding', { redirect: 'manual' })).json()
    expect(data.name).toBe('Freiwillige Feuerwehr Testdorf')
    expect(data.shortName).toBe('FT')
  })

  it('weist einen zu langen Kurznamen ab', async () => {
    const response = await admin('/api/admin/settings/branding', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Gültiger Name', shortName: 'ZuLangerKurzname' }),
    })
    expect(response.status).toBe(400)
  })

  it('speichert ein hochgeladenes Logo; die öffentliche Route liefert es als data-URI', async () => {
    const form = new FormData()
    form.append('logo', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), 'logo.png')

    const response = await fetch('/api/admin/settings/branding/logo', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: form,
      redirect: 'manual',
    })
    expect(response.status).toBe(200)

    const data = await (await fetch('/api/branding', { redirect: 'manual' })).json()
    expect(data.logoUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('weist einen unpassenden Dateityp ab', async () => {
    const form = new FormData()
    form.append('logo', new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }), 'logo.pdf')

    const response = await fetch('/api/admin/settings/branding/logo', {
      method: 'POST',
      headers: { cookie: adminCookie },
      body: form,
      redirect: 'manual',
    })
    expect(response.status).toBe(400)
  })
})

describe('SMTP-Relay', () => {
  it('weist Gäste und Unangemeldete ab', async () => {
    expect((await admin('/api/admin/settings/mail', {}, null)).status).toBe(401)
    expect((await admin('/api/admin/settings/mail', {}, memberCookie)).status).toBe(403)
  })

  it('liefert ohne gespeicherte Zeile leere Standardwerte', async () => {
    const data = await (await admin('/api/admin/settings/mail')).json()
    expect(data).toEqual({ host: '', port: 587, user: '', from: '', hasPassword: false, updatedAt: null })
  })

  it('weist eine Testmail ohne konfiguriertes Relay mit 422 ab', async () => {
    // Muss vor jedem Speichern eines Relays laufen (Reihenfolge der Datei) – sonst würde die
    // Route einen echten Verbindungsversuch unternehmen (.claude/rules/testing.md: kein
    // Netzwerkzugriff in Tests).
    const response = await admin('/api/admin/settings/mail/test', {
      method: 'POST',
      body: JSON.stringify({ to: 'ziel@example.org' }),
    })
    expect(response.status).toBe(422)
  })

  it('speichert die Werte, gibt aber nie ein Passwort zurück', async () => {
    const saveResponse = await admin('/api/admin/settings/mail', {
      method: 'PATCH',
      body: JSON.stringify({
        host: 'smtp.example.org',
        port: 2525,
        user: 'wehr@example.org',
        password: 'geheimes-passwort',
        from: 'wehr@example.org',
      }),
    })
    expect(saveResponse.status).toBe(200)

    const saved = await saveResponse.json()
    expect(saved).not.toHaveProperty('password')
    expect(saved.hasPassword).toBe(true)
    expect(saved.host).toBe('smtp.example.org')
    expect(saved.port).toBe(2525)

    const data = await (await admin('/api/admin/settings/mail')).json()
    expect(data).not.toHaveProperty('password')
    expect(data.hasPassword).toBe(true)
  })

  it('behält das gespeicherte Passwort, wenn beim Speichern keins mitgeschickt wird', async () => {
    const response = await admin('/api/admin/settings/mail', {
      method: 'PATCH',
      body: JSON.stringify({ host: 'smtp.example.org', port: 2525, user: 'wehr@example.org', from: 'wehr@example.org' }),
    })
    const data = await response.json()
    expect(data.hasPassword).toBe(true)
  })

  it('weist einen ungültigen Empfänger ab', async () => {
    const response = await admin('/api/admin/settings/mail/test', {
      method: 'POST',
      body: JSON.stringify({ to: 'keine-email-adresse' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('E-Mail-Vorlagen', () => {
  it('weist Gäste und Unangemeldete bei der Liste ab', async () => {
    expect((await admin('/api/admin/settings/mail-templates', {}, null)).status).toBe(401)
    expect((await admin('/api/admin/settings/mail-templates', {}, memberCookie)).status).toBe(403)
  })

  it('liefert alle sechs Vorlagen, anfangs unverändert', async () => {
    const data = await (await admin('/api/admin/settings/mail-templates')).json()

    expect(data).toHaveLength(6)
    expect(data.every((entry: { isCustom: boolean }) => entry.isCustom === false)).toBe(true)
    const abgesagt = data.find((entry: { key: string }) => entry.key === 'lehrgang-abgesagt')
    expect(abgesagt.subject).toBe('Abgesagt: {{courseTitle}}')
  })

  it('speichert eine angepasste Vorlage; die Liste zeigt sie danach als individualisiert', async () => {
    const response = await admin('/api/admin/settings/mail-templates/lehrgang-abgesagt', {
      method: 'PATCH',
      body: JSON.stringify({ subject: 'Fällt aus: {{courseTitle}}', body: 'Neuer Text {{organisation}}' }),
    })
    expect(response.status).toBe(200)
    const saved = await response.json()
    expect(saved.isCustom).toBe(true)
    expect(saved.subject).toBe('Fällt aus: {{courseTitle}}')

    const data = await (await admin('/api/admin/settings/mail-templates')).json()
    const abgesagt = data.find((entry: { key: string }) => entry.key === 'lehrgang-abgesagt')
    expect(abgesagt.isCustom).toBe(true)
    expect(abgesagt.subject).toBe('Fällt aus: {{courseTitle}}')
  })

  it('setzt eine angepasste Vorlage wieder auf den Standard zurück', async () => {
    const response = await admin('/api/admin/settings/mail-templates/lehrgang-abgesagt/reset', { method: 'POST' })
    expect(response.status).toBe(200)
    const reset = await response.json()
    expect(reset.isCustom).toBe(false)
    expect(reset.subject).toBe('Abgesagt: {{courseTitle}}')
  })

  it('weist einen unbekannten Vorlagenschlüssel ab', async () => {
    const response = await admin('/api/admin/settings/mail-templates/gibt-es-nicht', {
      method: 'PATCH',
      body: JSON.stringify({ subject: 'x', body: 'y' }),
    })
    expect(response.status).toBe(400)
  })

  it('weist eine leere Vorlage ab', async () => {
    const response = await admin('/api/admin/settings/mail-templates/lehrgang-abgesagt', {
      method: 'PATCH',
      body: JSON.stringify({ subject: '', body: '' }),
    })
    expect(response.status).toBe(400)
  })

  it('rendert eine Vorschau mit Beispieldaten, ohne zu speichern', async () => {
    const response = await admin('/api/admin/settings/mail-templates/lehrgang-abgesagt/preview', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Vorschau {{courseTitle}}', body: 'Hallo {{organisation}}' }),
    })
    expect(response.status).toBe(200)
    const preview = await response.json()
    expect(preview.subject).toContain('Vorschau')
    expect(preview.text).toContain('Hallo')

    // Nicht gespeichert: die Liste zeigt weiterhin den Standardtext.
    const data = await (await admin('/api/admin/settings/mail-templates')).json()
    const abgesagt = data.find((entry: { key: string }) => entry.key === 'lehrgang-abgesagt')
    expect(abgesagt.subject).toBe('Abgesagt: {{courseTitle}}')
  })
})
