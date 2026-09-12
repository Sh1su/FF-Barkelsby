import { createMemberSchema } from '../../../../shared/validation/user'
import { createMemberAccount } from '../../../services/user-admin.service'

/**
 * Mitgliedskonto anlegen (FV-16, AC-1 bis AC-3).
 *
 * Bewusst eine eigene Route statt eines `role`-Felds auf `POST /api/admin/users`: so kann auf
 * keiner der beiden Routen eine Rolle aus dem Request-Body kommen (.claude/rules/security.md,
 * kein Mass Assignment) – jede Route legt ihre Rolle serverseitig fest.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await readValidatedBody(event, createMemberSchema.parse)

  const { account, generatedPassword } = await createMemberAccount(input)

  setResponseStatus(event, 201)
  return generatedPassword ? { ...account, generatedPassword } : account
})
