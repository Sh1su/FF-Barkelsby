import { getMailSettingsView } from '../../../services/mail-settings.service'

/** Aktuelles SMTP-Relay lesen (Verwaltung, Einstellungen) – nie das Passwort im Klartext. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return getMailSettingsView()
})
