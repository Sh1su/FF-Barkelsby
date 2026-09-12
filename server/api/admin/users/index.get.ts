import { z } from 'zod'
import { USER_ROLES } from '../../../../shared/constants'
import { listAccounts } from '../../../services/user-admin.service'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  // FV-16, AC-5: optional auf eine Rolle eingrenzen.
  role: z.enum(USER_ROLES).optional(),
})

/** Kontenliste ohne Passwort-Hashes (FV-7, AC-1, AC-10, AC-11; FV-16, AC-5: Rollen-Filter). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, querySchema.parse)

  return listAccounts(query)
})
