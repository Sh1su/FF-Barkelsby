import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '../constants'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Bitte E-Mail eingeben.').max(254).toLowerCase(),
  password: z.string().min(1, 'Bitte Passwort eingeben.').max(200),
})
export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Bitte aktuelles Passwort eingeben.').max(200),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`)
    .max(200),
})
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
