import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { loginSchema } from '../../../shared/validation/auth'
import { SESSION_MAX_AGE_SECONDS } from '../../../shared/constants'
import { users } from '../../database/schema'

/**
 * Anmeldung fuer Gast- und Admin-Konten (FV-1, AC-2 bis AC-8).
 * Oeffentlich erreichbar, deshalb mit Rate Limit pro IP.
 */
export default defineEventHandler(async (event) => {
  const ip = clientIp(event)
  const limit = checkRateLimit(ip)
  if (!limit.allowed) {
    setResponseHeader(event, 'retry-after', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.',
    })
  }

  const { email, password } = await readValidatedBody(event, loginSchema.parse)
  const db = useDatabase()

  const user = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  // Generische Antwort: keine Auskunft, ob das Konto existiert (AC-4).
  const invalid = () => {
    recordFailure(ip)
    return createError({ statusCode: 401, statusMessage: 'E-Mail oder Passwort ist falsch.' })
  }

  if (!user || user.deactivatedAt) throw invalid()
  if (!(await verifyPasswordHash(user.passwordHash, password))) throw invalid()

  resetRateLimit(ip)

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword,
    },
    sid: randomUUID(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS[user.role] * 1000,
    loggedInAt: Date.now(),
  })

  return {
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }
})
