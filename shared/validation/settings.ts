import { z } from 'zod'
import { MAIL_TEMPLATE_KEYS } from '../mail-templates'

/** Erscheinungsbild der Wehr – Name und Kurzname (Verwaltung, Einstellungen). */
export const brandingSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(120),
  shortName: z.string().trim().min(1, 'Bitte einen Kurznamen angeben.').max(8),
})
export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>

/**
 * SMTP-Relay (Verwaltung, Einstellungen). Leere `host`/`from` deaktivieren den Versand –
 * dieselbe Semantik wie die bisherigen NUXT_SMTP_*-Env-Variablen.
 */
export const mailSettingsSchema = z.object({
  host: z.string().trim().max(255),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  user: z.string().trim().max(255).default(''),
  /** Leer = bestehendes Passwort behalten. */
  password: z.string().max(255).optional(),
  from: z.string().trim().max(255),
})
export type MailSettingsInput = z.infer<typeof mailSettingsSchema>

export const mailTestSchema = z.object({
  to: z.string().trim().email('Bitte eine gültige E-Mail-Adresse angeben.'),
})

export const mailTemplateKeySchema = z.object({
  key: z.enum(MAIL_TEMPLATE_KEYS as [string, ...string[]]),
})

/** Vorlagentext (Verwaltung, Einstellungen) – `{{feld}}`/`{{#if feld}}…{{/if}}`, siehe mail-templates.ts. */
export const mailTemplateContentSchema = z.object({
  subject: z.string().trim().min(1, 'Bitte einen Betreff angeben.').max(200),
  body: z.string().trim().min(1, 'Bitte einen Text angeben.').max(5000),
})
