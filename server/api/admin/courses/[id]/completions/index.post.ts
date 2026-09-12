import { courseIdSchema } from '../../../../../../shared/validation/course'
import { createCompletionSchema } from '../../../../../../shared/validation/completion'
import { createCompletion } from '../../../../../services/course-completion.service'

/** Abschluss eintragen, auch rueckwirkend (FV-18, AC-2 bis AC-4). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)
  const input = await readValidatedBody(event, createCompletionSchema.parse)

  setResponseStatus(event, 201)
  return createCompletion(id, input)
})
