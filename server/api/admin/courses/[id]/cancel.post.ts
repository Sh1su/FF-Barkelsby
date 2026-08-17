import { cancelCourseSchema, courseIdSchema } from '../../../../../shared/validation/course'
import { transitionCourse } from '../../../../services/course-admin.service'

/** Absagen und Zurücknehmen der Absage (FV-3, AC-10/AC-11). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)
  const { cancelled } = await readValidatedBody(event, cancelCourseSchema.parse)

  return await transitionCourse(id, cancelled ? 'abgesagt' : 'geplant')
})
