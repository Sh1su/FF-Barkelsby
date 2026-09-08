import { mailTestSchema } from '../../../../../shared/validation/settings'

/**
 * Testmail ueber das aktuell aktive Relay verschicken (Verwaltung, Einstellungen) – dieselbe
 * `readMailConfig()`, die auch echte Lehrgangs-Mails verschickt, also erst nach dem Speichern
 * aussagekraeftig.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { to } = await readValidatedBody(event, mailTestSchema.parse)

  const config = readMailConfig()
  if (!config) {
    throw createError({ statusCode: 422, statusMessage: 'Kein SMTP-Relay konfiguriert.' })
  }

  const result = await sendMail(
    { to, subject: 'Testmail', text: 'Diese Testmail bestätigt, dass das SMTP-Relay funktioniert.' },
    config,
  )

  if (!result.ok) {
    throw createError({ statusCode: 502, statusMessage: result.error ?? 'Versand fehlgeschlagen.' })
  }

  return { ok: true }
})
