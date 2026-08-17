import { courseIdSchema, updateCourseSchema } from '../../../../../shared/validation/course'
import { updateCourse } from '../../../../services/course-admin.service'

/** Detail-Bearbeitung inkl. Programmtagen (FV-3, AC-8, AC-9, AC-14). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)
  const input = await readValidatedBody(event, updateCourseSchema.parse)

  return await updateCourse(id, input)
})
