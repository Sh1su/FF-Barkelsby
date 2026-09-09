import { brandingSettingsSchema } from '../../../../shared/validation/settings'
import { saveBrandingText } from '../../../services/branding.service'

/** Name und Kurzname der Wehr aendern (Verwaltung, Einstellungen). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await readValidatedBody(event, brandingSettingsSchema.parse)

  return saveBrandingText(input)
})
