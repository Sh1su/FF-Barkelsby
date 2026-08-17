import { courseIdSchema } from '../../../../../shared/validation/course'
import { signupsCsv } from '../../../../services/signup-admin.service'

/** Anwesenheitsliste als CSV (FV-6, AC-7). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)

  const { filename, content } = signupsCsv(id)

  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  return content
})
