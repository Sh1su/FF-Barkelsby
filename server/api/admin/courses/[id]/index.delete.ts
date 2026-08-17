import { courseIdSchema } from '../../../../../shared/validation/course'
import { deleteCourse } from '../../../../services/course-admin.service'

/** Löschen nur ohne Anmeldungen (FV-3, AC-12). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)

  return deleteCourse(id)
})
