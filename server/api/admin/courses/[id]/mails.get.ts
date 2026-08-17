import { courseIdSchema } from '../../../../../shared/validation/course'
import { mailLogForCourse } from '../../../../services/mail.service'

/**
 * Mailprotokoll eines Lehrgangs (FV-4, AC-8).
 * Zeigt der Wehrführung, ob eine Benachrichtigung rausgegangen ist – ohne Nachrichtentext.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)

  return { items: mailLogForCourse(id) }
})
