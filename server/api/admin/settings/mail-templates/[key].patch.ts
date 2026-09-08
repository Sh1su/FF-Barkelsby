import type { MailTemplate } from '../../../../../shared/mail-templates'
import { mailTemplateContentSchema, mailTemplateKeySchema } from '../../../../../shared/validation/settings'
import { saveMailTemplate } from '../../../../services/mail-templates.service'

/** Eine E-Mail-Vorlage speichern (Verwaltung, Einstellungen). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { key } = await getValidatedRouterParams(event, mailTemplateKeySchema.parse)
  const input = await readValidatedBody(event, mailTemplateContentSchema.parse)

  return saveMailTemplate(key as MailTemplate, input)
})
