import type { H3Event } from 'h3'
import type { UserRole } from '../../shared/constants'

/**
 * Zentrale Berechtigungslogik. SQLite kennt kein Row Level Security – jede Route
 * prueft hier, nicht in der Datenbank (.claude/rules/backend.md).
 *
 * Rollenmodell: `guest` < `admin`. Mehr gibt es bewusst nicht (PRD, Q1/Q8).
 */

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  displayName: string
  mustChangePassword: boolean
}

/** Routen, die ohne Anmeldung erreichbar sein muessen. Bewusst kurz und explizit. */
export const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/auth/login',
  '/api/_auth/session',
  // Abmelde-Link aus der E-Mail: der Empfaenger hat keine Sitzung, der Zufallstoken
  // ist der Berechtigungsnachweis (FV-5, AC-8).
  '/api/abmeldung',
] as const

/** Routen, die auch mit erzwungenem Passwortwechsel noch erreichbar sind. */
export const PASSWORD_CHANGE_ALLOWED_ROUTES = [
  '/api/auth/password',
  '/api/auth/logout',
  '/api/_auth/session',
] as const

export function isPublicApiRoute(path: string): boolean {
  return PUBLIC_API_ROUTES.some(route => path === route || path.startsWith(`${route}/`))
}

export function isAllowedDuringPasswordChange(path: string): boolean {
  return PASSWORD_CHANGE_ALLOWED_ROUTES.some(route => path === route)
}

/** Wirft 401, wenn keine gueltige Session vorliegt. */
export async function requireAuth(event: H3Event): Promise<SessionUser> {
  const session = await requireUserSession(event)
  return session.user as SessionUser
}

/** Wirft 401 ohne Session, 403 fuer Gaeste. */
export async function requireAdmin(event: H3Event): Promise<SessionUser> {
  const user = await requireAuth(event)
  assertRole(user, 'admin')
  return user
}

export function assertRole(user: SessionUser, role: UserRole): void {
  if (user.role !== role) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Für diesen Bereich fehlt die Berechtigung.',
    })
  }
}

export function isAdmin(user: Pick<SessionUser, 'role'> | null | undefined): boolean {
  return user?.role === 'admin'
}
