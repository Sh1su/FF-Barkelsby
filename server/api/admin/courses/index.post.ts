import { createCourseSchema } from '../../../../shared/validation/course'
import { createCourse } from '../../../services/course-admin.service'

/** Schnellanlage aus dem Kalender (FV-3, AC-4 bis AC-7). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await readValidatedBody(event, createCourseSchema.parse)

  setResponseStatus(event, 201)
  return createCourse(input)
})
