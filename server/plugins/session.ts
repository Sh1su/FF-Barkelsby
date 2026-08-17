/**
 * Haengt die Sperrliste an das Auslesen der Session (FV-1, AC-8, AC-12).
 *
 * `/api/_auth/session` ist bewusst oeffentlich, damit der Browser den Anmeldezustand
 * abfragen kann. Ohne diesen Hook wuerde der Endpunkt eine abgemeldete oder abgelaufene
 * Session weiterhin als gueltig melden – die Oberflaeche saehe angemeldet aus, obwohl
 * jede geschuetzte Route bereits 401 liefert.
 */
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    const sid = (session as { sid?: string }).sid
    const expiresAt = (session as { expiresAt?: number }).expiresAt

    const expired = typeof expiresAt === 'number' && expiresAt <= Date.now()
    const revoked = !sid || isSessionRevoked(sid)

    if (expired || revoked) {
      delete (session as { user?: unknown }).user
      await clearUserSession(event)
    }
  })
})
