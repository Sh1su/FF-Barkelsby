import { z } from 'zod'
import { listAccounts } from '../../../services/user-admin.service'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** Kontenliste ohne Passwort-Hashes (FV-7, AC-1, AC-10, AC-11). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = await getValidatedQuery(event, querySchema.parse)

  return listAccounts(query)
})
