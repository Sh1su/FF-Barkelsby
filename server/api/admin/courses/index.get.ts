import { adminCourseRangeSchema } from '../../../../shared/validation/course'
import { confirmedCountsByCourse, listCoursesInRange } from '../../../services/course-admin.service'

/** Kalenderdaten der Verwaltung (FV-3, AC-1 bis AC-3). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { von, bis } = await getValidatedQuery(event, adminCourseRangeSchema.parse)

  const items = listCoursesInRange(von, bis)
  const confirmed = confirmedCountsByCourse()

  return {
    items: items.map(item => ({ ...item, confirmedCount: confirmed[item.id] ?? 0 })),
  }
})
