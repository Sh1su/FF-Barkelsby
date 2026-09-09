import { getBranding } from '../services/branding.service'

/**
 * Oeffentlich und ohne Anmeldung erreichbar: die Login-Seite braucht Name und Logo bereits
 * vor der Authentifizierung.
 */
export default defineEventHandler(() => {
  return getBranding()
})
