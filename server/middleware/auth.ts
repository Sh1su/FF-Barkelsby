import type { SessionUser } from '../utils/authorization'

/**
 * Sperrt die gesamte API hinter dem Login-Gate (FV-1, AC-1).
 *
 * Die Ausnahmeliste steht in server/utils/authorization.ts und ist bewusst kurz:
 * Healthcheck, Anmeldung und der Session-Endpunkt von nuxt-auth-utils.
 */
export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0] ?? ''
  if (!path.startsWith('/api/')) return

  const session = await getUserSession(event)
  const user = session?.user as SessionUser | undefined

  if (user) {
    // Rollenabhaengige Sitzungsdauer (FV-1, AC-8): das Cookie laeuft auf 30 Tage,
    // die tatsaechliche Gueltigkeit steht in der Session.
    const expiresAt = (session as { expiresAt?: number }).expiresAt
    const expired = typeof expiresAt === 'number' && expiresAt <= Date.now()

    // Abgemeldete Sessions (FV-1, AC-12): ein kopiertes Cookie darf nicht weitergelten.
    const sid = (session as { sid?: string }).sid
    const revoked = !sid || isSessionRevoked(sid)

    // Deaktivierte Konten verlieren ihre laufende Sitzung sofort (FV-7, AC-9) – sonst bliebe
    // ein gerade abgeschalteter Admin bis zu acht Stunden handlungsfaehig. Die Pruefung steht
    // bewusst vor dem Ausstieg fuer oeffentliche Routen: sonst meldete /api/_auth/session das
    // Konto weiter als angemeldet, und die Oberflaeche liefe in lauter 401 statt sauber zur
    // Anmeldung zurueckzuleiten (QA-Befund BUG-7-3).
    const deactivated = !isAccountActive(user.id)

    if (expired || revoked || deactivated) {
      await clearUserSession(event)
      // Sonst entsiegelt der naechste Lesezugriff im selben Request den Cookie aus der
      // Anfrage erneut – siehe server/utils/session-cookie.ts.
      forgetRequestSessionCookie(event)
      if (isPublicApiRoute(path)) return
      throw createError({
        statusCode: 401,
        statusMessage: deactivated
          ? 'Dieses Konto ist nicht mehr aktiv.'
          : 'Sitzung ist nicht mehr gültig.',
      })
    }
  }

  if (isPublicApiRoute(path)) return

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet.' })
  }

  // Erzwungener Passwortwechsel (FV-1, AC-10)
  if (user.mustChangePassword && !isAllowedDuringPasswordChange(path)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Das Startpasswort muss zuerst geändert werden.',
    })
  }
})
