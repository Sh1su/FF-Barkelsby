import { updateUserSchema, userIdSchema } from '../../../../shared/validation/user'
import { updateAccount } from '../../../services/user-admin.service'

/** Kennung, Passwort oder Zustand eines Kontos ändern (FV-7, AC-3 bis AC-8, AC-12). */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, userIdSchema.parse)
  const input = await readValidatedBody(event, updateUserSchema.parse)

  return await updateAccount(id, input, admin.id)
})
