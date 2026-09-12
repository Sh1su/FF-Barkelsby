import { courseListQuerySchema } from '../../../shared/validation/course'
import { listUpcomingCourses } from '../../services/course.service'

/** Lehrgangsübersicht der Mitglied-Ansicht (FV-2, AC-1 bis AC-4, AC-11). */
export default defineEventHandler(async (event) => {
  const viewer = await requireAuth(event)
  const query = await getValidatedQuery(event, courseListQuerySchema.parse)

  return listUpcomingCourses(query, viewer)
})
