import { z } from 'zod'
import { isoDate } from './course'

/**
 * Abschluss eintragen (FV-18, AC-2). `completedAt` fehlt bewusst optional – ohne Angabe gilt
 * das heutige Datum (Service, nicht hier, da das Schema keine Uhrzeit kennt).
 */
export const createCompletionSchema = z.object({
  userId: z.string().min(1).max(64),
  completedAt: isoDate.optional(),
  note: z.string().trim().max(300).optional(),
})
export type CreateCompletionInput = z.infer<typeof createCompletionSchema>

/** Routenparameter von `DELETE /api/admin/courses/:id/completions/:userId` (FV-18, AC-5). */
export const completionParamsSchema = z.object({
  id: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
})
