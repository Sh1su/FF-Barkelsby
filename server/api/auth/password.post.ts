import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { changePasswordSchema } from '../../../shared/validation/auth'
import { SESSION_MAX_AGE_SECONDS } from '../../../shared/constants'
import { users } from '../../database/schema'

/** Eigenes Passwort aendern (FV-1, AC-10, AC-13). */
export default defineEventHandler(async (event) => {
  const sessionUser = await requireAuth(event)
  const { currentPassword, newPassword } = await readValidatedBody(
    event,
    changePasswordSchema.parse,
  )

  const db = useDatabase()
  const user = db.select().from(users).where(eq(users.id, sessionUser.id)).get()

  if (!user || user.deactivatedAt) {
    throw createError({ statusCode: 401, statusMessage: 'Nicht angemeldet.' })
  }

  if (!(await verifyPasswordHash(user.passwordHash, currentPassword))) {
    throw createError({ statusCode: 400, statusMessage: 'Das aktuelle Passwort ist falsch.' })
  }

  if (await verifyPasswordHash(user.passwordHash, newPassword)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Das neue Passwort muss sich vom alten unterscheiden.',
    })
  }

  db.update(users)
    .set({
      passwordHash: await createPasswordHash(newPassword),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .run()

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      mustChangePassword: false,
    },
    sid: randomUUID(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS[user.role] * 1000,
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
