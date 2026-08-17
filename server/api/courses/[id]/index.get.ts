import { courseIdSchema } from '../../../../shared/validation/course'
import { getCourseDetail } from '../../../services/course.service'

/** Detailseite eines Lehrgangs (FV-2, AC-8). */
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)

  return getCourseDetail(id)
})
