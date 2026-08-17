import { SIGNUP_RATE_LIMIT } from '../../../../shared/constants'
import { courseIdSchema } from '../../../../shared/validation/course'
import { createSignupSchema } from '../../../../shared/validation/signup'
import { createSignup } from '../../../services/signup.service'

/** Interessensbekundung (FV-5, AC-2 bis AC-7, AC-10). */
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  // Eigener Zaehler je IP, damit ein Fehlversuch beim Anmelden nicht das Login-Limit trifft.
  const key = `signup:${clientIp(event)}`
  const limit = checkRateLimit(key, Date.now(), SIGNUP_RATE_LIMIT)
  if (!limit.allowed) {
    setResponseHeader(event, 'retry-after', limit.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: 'Zu viele Anmeldungen in kurzer Zeit. Bitte später erneut versuchen.',
    })
  }
  recordFailure(key)

  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)
  const input = await readValidatedBody(event, createSignupSchema.parse)

  setResponseStatus(event, 201)
  return await createSignup(id, input)
})
