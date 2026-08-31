import { courseIdSchema, coverQuerySchema } from '../../../../shared/validation/course'
import { getCourseCoverInput } from '../../../services/course.service'
import { renderCover } from '../../../utils/cover'

/**
 * Generiertes Titelbild (FV-2, AC-9/AC-10).
 * Deterministisch: gleiche ID ergibt immer dasselbe Bild.
 */
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const { id } = await getValidatedRouterParams(event, courseIdSchema.parse)
  const { variant } = await getValidatedQuery(event, coverQuerySchema.parse)
  const course = getCourseCoverInput(id)

  const svg = renderCover({
    id: course.id,
    title: course.title,
    motif: course.motif,
    palette: course.palette,
    variant,
  })

  setResponseHeader(event, 'content-type', 'image/svg+xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'private, max-age=3600')
  return svg
})
