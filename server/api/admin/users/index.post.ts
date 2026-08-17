import { createUserSchema } from '../../../../shared/validation/user'
import { createAdminAccount } from '../../../services/user-admin.service'

/** Weiteres Admin-Konto anlegen (FV-7, AC-2, AC-8, AC-10). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await readValidatedBody(event, createUserSchema.parse)

  setResponseStatus(event, 201)
  return await createAdminAccount(input)
})
