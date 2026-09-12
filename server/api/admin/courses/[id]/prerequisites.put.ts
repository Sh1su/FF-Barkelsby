import { courseIdSchema } from '../../../../../shared/validation/course'
import { setPrerequisitesSchema } from '../../../../../shared/validation/course-prerequisites'
import { getPrerequisites, setPrerequisites } from '../../../../services/course-prerequisites.service'

/** Ersetzt die komplette Voraussetzungsmenge eines Lehrgangs (FV-17, AC-3 bis AC-5). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)
  const { requiredCourseIds } = await readValidatedBody(event, setPrerequisitesSchema.parse)

  setPrerequisites(id, requiredCourseIds)
  return { items: getPrerequisites(id) }
})
