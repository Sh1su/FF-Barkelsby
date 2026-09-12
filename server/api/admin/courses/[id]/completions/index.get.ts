import { courseIdSchema } from '../../../../../../shared/validation/course'
import { listCompletions } from '../../../../../services/course-completion.service'

/** Abschluss-Historie eines Lehrgangs (FV-18, AC-6). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)

  return { items: listCompletions(id) }
})
