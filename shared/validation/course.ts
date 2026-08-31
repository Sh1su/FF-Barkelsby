import { z } from 'zod'

/** Filter der Lehrgangsübersicht (FV-2, AC-2/AC-3/AC-11). */
export const courseListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export type CourseListQuery = z.infer<typeof courseListQuerySchema>

export const courseIdSchema = z.object({
  id: z.string().min(1).max(64),
})

export const coverQuerySchema = z.object({
  variant: z.enum(['card', 'hero']).default('card'),
})

/**
 * Schnellanlage im Kalender (FV-3, AC-5). Enthaelt bewusst nur die Felder des Designs.
 * `status`, Zeitstempel und Belegung kommen niemals aus dem Request-Body.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein Datum im Format JJJJ-MM-TT.')

export const createCourseSchema = z
  .object({
    title: z.string().trim().min(3, 'Bitte einen Titel angeben.').max(160),
    startsOn: isoDate,
    endsOn: isoDate,
    capacity: z.coerce.number().int().min(1, 'Bitte eine Platzzahl größer 0 angeben.').max(999),
    motif: z.coerce.number().int().min(0).max(7).optional(),
    palette: z.coerce.number().int().min(0).max(3).optional(),
  })
  .refine(value => value.endsOn >= value.startsOn, {
    message: 'Das Ende darf nicht vor dem Beginn liegen.',
    path: ['endsOn'],
  })
export type CreateCourseInput = z.infer<typeof createCourseSchema>

export const courseDayInputSchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(60),
  date: isoDate.optional(),
  timeLabel: z.string().trim().max(60).optional(),
  title: z.string().trim().min(1).max(160),
  bullets: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
})

/** Detail-Bearbeitung (FV-3, AC-8/AC-9). */
export const updateCourseSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    summary: z.string().trim().max(300).optional(),
    description: z.string().trim().max(5000).optional(),
    topics: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    startsOn: isoDate.optional(),
    endsOn: isoDate.optional(),
    capacity: z.coerce.number().int().min(1, 'Bitte eine Platzzahl größer 0 angeben.').max(999).optional(),
    motif: z.coerce.number().int().min(0).max(7).nullable().optional(),
    palette: z.coerce.number().int().min(0).max(3).nullable().optional(),
    days: z.array(courseDayInputSchema).max(60).optional(),
    /** Optimistisches Sperren: Stand, den der Client geladen hat. */
    updatedAt: z.coerce.number().int().optional(),
  })
  .refine(
    value => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn,
    { message: 'Das Ende darf nicht vor dem Beginn liegen.', path: ['endsOn'] },
  )
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>

export const cancelCourseSchema = z.object({
  cancelled: z.boolean(),
})

export const adminCourseRangeSchema = z.object({
  von: isoDate.optional(),
  bis: isoDate.optional(),
})
