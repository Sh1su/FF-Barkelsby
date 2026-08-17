import { z } from 'zod'
import { SIGNUP_STATUSES } from '../../../../shared/constants'
import { listSignups } from '../../../services/signup-admin.service'

const querySchema = z.object({
  status: z.enum(SIGNUP_STATUSES).optional().catch(undefined),
  lehrgang: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** Registratur der Verwaltung (FV-6, AC-1, AC-2, AC-10, AC-11). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, querySchema.parse)

  return listSignups(query)
})
