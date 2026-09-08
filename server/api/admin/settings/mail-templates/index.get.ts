import { listMailTemplates } from '../../../../services/mail-templates.service'

/** Alle sechs E-Mail-Vorlagen mit aktuellem Text (Verwaltung, Einstellungen). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return listMailTemplates()
})
