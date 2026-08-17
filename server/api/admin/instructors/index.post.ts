import { instructorSchema } from '../../../../shared/validation/course'
import { createInstructor } from '../../../services/course-admin.service'

/** Ausbilder anlegen (FV-3, AC-8). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await readValidatedBody(event, instructorSchema.parse)

  setResponseStatus(event, 201)
  return createInstructor(input)
})
