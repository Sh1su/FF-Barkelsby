import { z } from 'zod'

/**
 * Ersetzt die komplette Voraussetzungsmenge eines Lehrgangs (FV-17, AC-3). Eine leere Liste
 * entfernt alle Voraussetzungen – deshalb kein `.min(1)`.
 */
export const setPrerequisitesSchema = z.object({
  requiredCourseIds: z.array(z.string().min(1).max(64)).max(50),
})
export type SetPrerequisitesInput = z.infer<typeof setPrerequisitesSchema>
