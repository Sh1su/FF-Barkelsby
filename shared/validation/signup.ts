import { z } from 'zod'

/** Drei Felder plus Einwilligung – mehr erhebt die Anwendung bewusst nicht (PRD, Q16). */
export const createSignupSchema = z.object({
  firstName: z.string().trim().min(2, 'Bitte den Vornamen angeben.').max(80),
  lastName: z.string().trim().min(2, 'Bitte den Nachnamen angeben.').max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('Bitte eine gültige E-Mail-Adresse angeben.')),
  consent: z.literal(true, {
    message: 'Ohne Einwilligung zur Datenverarbeitung ist keine Anmeldung möglich.',
  }),
})
export type CreateSignupInput = z.infer<typeof createSignupSchema>

export const cancelTokenSchema = z.object({
  token: z.string().min(10).max(64),
})
