import { mailSettingsSchema } from '../../../../shared/validation/settings'
import { saveMailSettings } from '../../../services/mail-settings.service'

/** SMTP-Relay speichern (Verwaltung, Einstellungen). Leere host/from deaktivieren den Versand. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await readValidatedBody(event, mailSettingsSchema.parse)

  return saveMailSettings(input)
})
