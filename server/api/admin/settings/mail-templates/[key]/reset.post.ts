import type { MailTemplate } from '../../../../../../shared/mail-templates'
import { mailTemplateKeySchema } from '../../../../../../shared/validation/settings'
import { resetMailTemplate } from '../../../../../services/mail-templates.service'

/** Angepasste Vorlage verwerfen – rendert danach wieder mit dem Standardtext. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { key } = await getValidatedRouterParams(event, mailTemplateKeySchema.parse)

  return resetMailTemplate(key as MailTemplate)
})
