import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '../constants'

const kennung = z.string().trim().toLowerCase().max(254).pipe(z.email('Bitte eine gültige Kennung im E-Mail-Format angeben.'))
const passwort = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`)
  .max(200)

/** Weiteres Admin-Konto anlegen (FV-7, AC-2). */
export const createUserSchema = z.object({
  email: kennung,
  displayName: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(80),
  password: passwort,
})
export type CreateUserInput = z.infer<typeof createUserSchema>

/**
 * Kennung, Passwort oder Zustand aendern. `role` fehlt bewusst – eine Rolle laesst sich
 * nicht ueber den Request umbiegen (.claude/rules/security.md, kein Mass Assignment).
 */
export const updateUserSchema = z
  .object({
    email: kennung.optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    password: passwort.optional(),
    active: z.boolean().optional(),
  })
  .refine(
    wert => Object.values(wert).some(feld => feld !== undefined),
    { message: 'Es wurde nichts zum Ändern übergeben.' },
  )
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const userIdSchema = z.object({ id: z.string().min(1).max(64) })
