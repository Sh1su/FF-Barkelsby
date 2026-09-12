import { completionParamsSchema } from '../../../../../../shared/validation/completion'
import { deleteCompletion } from '../../../../../services/course-completion.service'

/** Versehentlichen Eintrag wieder entfernen (FV-18, AC-5). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id, userId } = await getValidatedRouterParams(event, completionParamsSchema.parse)

  return deleteCompletion(id, userId)
})
