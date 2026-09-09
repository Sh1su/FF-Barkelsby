import { mailTemplateContentSchema, mailTemplateKeySchema } from '../../../../../../shared/validation/settings'
import { previewMailTemplate } from '../../../../../services/mail-templates.service'

/**
 * Vorschau mit Beispieldaten (Verwaltung, Einstellungen) – rendert den im Editor stehenden,
 * noch ungespeicherten Text. `key` wird nur validiert, nicht für die Vorschau selbst gebraucht.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await getValidatedRouterParams(event, mailTemplateKeySchema.parse)
  const input = await readValidatedBody(event, mailTemplateContentSchema.parse)

  return previewMailTemplate(input)
})
