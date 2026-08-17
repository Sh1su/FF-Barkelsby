import { listInstructors } from '../../../services/course-admin.service'

/** Auswahlliste der Ausbilder (FV-3, AC-8). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return { items: listInstructors() }
})
