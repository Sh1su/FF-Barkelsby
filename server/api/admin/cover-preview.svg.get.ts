import { z } from 'zod'
import { renderCover } from '../../utils/cover'

const previewSchema = z.object({
  motif: z.coerce.number().int().min(0).max(7),
  palette: z.coerce.number().int().min(0).max(3),
  title: z.string().max(160).default('Vorschau'),
  category: z.string().max(80).default('Lehrgang'),
})

/** Vorschau der Motive im Anlege-Dialog (FV-3, AC-5). Nutzt denselben Generator wie FV-2. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { motif, palette, title, category } = await getValidatedQuery(event, previewSchema.parse)

  setResponseHeader(event, 'content-type', 'image/svg+xml; charset=utf-8')
  return renderCover({ id: `preview-${motif}-${palette}`, title, category, motif, palette, variant: 'card' })
})
