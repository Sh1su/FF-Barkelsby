import { z } from 'zod'
import { transitionSignup } from '../../../services/signup-admin.service'

const paramsSchema = z.object({ id: z.string().min(1).max(64) })

// Nur die drei Ziele, die die Verwaltung setzen darf – `storniert` gehört dem Teilnehmer.
const bodySchema = z.object({ status: z.enum(['offen', 'bestaetigt', 'abgelehnt']) })

/** Bestätigen, Ablehnen, Rückgängig (FV-6, AC-3 bis AC-5). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { status } = await readValidatedBody(event, bodySchema.parse)

  return await transitionSignup(id, status)
})
