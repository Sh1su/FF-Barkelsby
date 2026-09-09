import { eq } from 'drizzle-orm'
import { mailSettings } from '../database/schema'

/**
 * SMTP-Relay der Verwaltungsseite – loest die bisherige reine Env-Var-Konfiguration ab
 * (`mailer.ts` bevorzugt diese Zeile, faellt ohne sie auf NUXT_SMTP_* zurueck). Genau eine
 * Zeile in `mail_settings` (`id = 'default'`). Das Passwort steht nur verschluesselt in der
 * Datenbank und verlaesst diesen Dienst nie im Klartext an die Oberflaeche.
 */

const SETTINGS_ID = 'default'

export interface MailSettingsView {
  host: string
  port: number
  user: string
  from: string
  hasPassword: boolean
  updatedAt: Date | null
}

function row() {
  return useDatabase().select().from(mailSettings).where(eq(mailSettings.id, SETTINGS_ID)).get()
}

export function getMailSettingsView(): MailSettingsView {
  const existing = row()
  if (!existing) {
    return { host: '', port: 587, user: '', from: '', hasPassword: false, updatedAt: null }
  }

  return {
    host: existing.host,
    port: existing.port,
    user: existing.user,
    from: existing.fromAddress,
    hasPassword: !!existing.passwordEncrypted,
    updatedAt: existing.updatedAt,
  }
}

export interface SaveMailSettingsInput {
  host: string
  port: number
  user: string
  /** Leer/undefined = bestehendes Passwort behalten – die Oberflaeche zeigt es nie im Klartext an. */
  password?: string
  from: string
}

export function saveMailSettings(input: SaveMailSettingsInput): MailSettingsView {
  const db = useDatabase()
  const existing = row()
  const passwordEncrypted = input.password
    ? encryptSecret(input.password)
    : (existing?.passwordEncrypted ?? null)

  if (existing) {
    db.update(mailSettings)
      .set({
        host: input.host,
        port: input.port,
        user: input.user,
        passwordEncrypted,
        fromAddress: input.from,
        updatedAt: new Date(),
      })
      .where(eq(mailSettings.id, SETTINGS_ID))
      .run()
  }
  else {
    db.insert(mailSettings)
      .values({
        id: SETTINGS_ID,
        host: input.host,
        port: input.port,
        user: input.user,
        passwordEncrypted,
        fromAddress: input.from,
      })
      .run()
  }

  return getMailSettingsView()
}
