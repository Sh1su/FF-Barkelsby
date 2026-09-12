import { courseIdSchema } from '../../../../../shared/validation/course'
import { getPrerequisites } from '../../../../services/course-prerequisites.service'

/** Aktuelle Voraussetzungen eines Lehrgangs (FV-17, AC-6). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)

  return { items: getPrerequisites(id) }
})
