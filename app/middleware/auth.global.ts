/**
 * Weiterleitungen im Browser (FV-1, AC-1, AC-3, AC-10).
 *
 * Wichtig: Das ist reine Bedienlogik. Die verbindliche Absicherung liegt in
 * server/middleware/auth.ts – jede API-Route prueft die Session erneut.
 */
const PUBLIC_PAGES = ['/login', '/datenschutz']

/** Abmelde-Links aus E-Mails treffen ohne Sitzung ein – der Token ist der Nachweis (FV-5). */
const PUBLIC_PREFIXES = ['/abmeldung/']

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (PUBLIC_PREFIXES.some(prefix => to.path.startsWith(prefix))) return

  if (PUBLIC_PAGES.includes(to.path)) {
    if (loggedIn.value && to.path === '/login') {
      return navigateTo(user.value?.mustChangePassword
        ? '/passwort-aendern'
        : user.value?.role === 'admin' ? '/verwaltung' : '/')
    }
    return
  }

  if (!loggedIn.value) {
    return navigateTo({ path: '/login', query: to.path === '/' ? undefined : { weiter: to.fullPath } })
  }

  if (user.value?.mustChangePassword && to.path !== '/passwort-aendern') {
    return navigateTo('/passwort-aendern')
  }

  if (to.path.startsWith('/verwaltung') && user.value?.role !== 'admin') {
    return navigateTo('/')
  }
})
