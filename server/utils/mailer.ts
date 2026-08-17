import { createTransport, type Transporter } from 'nodemailer'
import { SMTP_TIMEOUT_MS } from '../../shared/constants'

/**
 * Kapselt den SMTP-Versand (FV-4).
 *
 * Ohne konfigurierten Host wird nichts versendet und kein Verbindungsversuch unternommen –
 * die Anwendung bleibt damit vollstaendig offline betreibbar (PRD, Constraints).
 * Zugangsdaten verlassen dieses Modul nicht.
 */

export interface MailConfig {
  host: string
  port: number
  user: string
  password: string
  from: string
}

/** Baut die Konfiguration aus einzelnen Werten – von Nitro und von der CLI genutzt. */
export function toMailConfig(values: {
  host?: string
  port?: string | number
  user?: string
  password?: string
  from?: string
}): MailConfig | null {
  const host = String(values.host ?? '').trim()
  const from = String(values.from ?? '').trim()
  if (!host || !from) return null

  return {
    host,
    port: Number(values.port ?? 587) || 587,
    user: String(values.user ?? ''),
    password: String(values.password ?? ''),
    from,
  }
}

/** Konfiguration aus Umgebungsvariablen (Gmail, IONOS oder jedes andere Relay). */
export function mailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MailConfig | null {
  return toMailConfig({
    host: env.NUXT_SMTP_HOST,
    port: env.NUXT_SMTP_PORT,
    user: env.NUXT_SMTP_USER,
    password: env.NUXT_SMTP_PASSWORD,
    from: env.NUXT_SMTP_FROM,
  })
}

export function readMailConfig(): MailConfig | null {
  const config = useRuntimeConfig()

  return toMailConfig({
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    password: config.smtpPassword,
    from: config.smtpFrom,
  })
}

export function isMailEnabled(): boolean {
  return readMailConfig() !== null
}

let transporter: Transporter | undefined
let transporterKey = ''

function getTransporter(config: MailConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.user}`
  if (!transporter || transporterKey !== key) {
    transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    })
    transporterKey = key
  }
  return transporter
}

export interface OutgoingMail {
  to: string
  subject: string
  text: string
}

/**
 * Versendet eine einzelne Nachricht. Wirft nicht – der Aufrufer protokolliert das Ergebnis
 * und faehrt fort; ein nicht erreichbares Relay darf keinen Vorgang scheitern lassen.
 */
export async function sendMail(
  mail: OutgoingMail,
  config: MailConfig | null = readMailConfig(),
): Promise<{ ok: boolean, error?: string }> {
  if (!config) return { ok: false, error: 'SMTP nicht konfiguriert' }

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    })
    return { ok: true }
  }
  catch (error) {
    // Nur die Meldung uebernehmen, niemals das Fehlerobjekt mit Verbindungsdaten.
    return { ok: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' }
  }
}

/** Nur fuer Tests: erzwingt beim naechsten Versand einen neuen Transport. */
export function _resetTransporter(): void {
  transporter = undefined
  transporterKey = ''
}
