import { cancelTokenSchema } from '../../../shared/validation/signup'
import { signupByToken } from '../../services/signup.service'

/**
 * Zeigt, welche Anmeldung hinter einem Abmelde-Link steckt (FV-5, AC-8/AC-9).
 * Bewusst ohne Anmeldung erreichbar – der Empfaenger der Mail hat keine Sitzung.
 * Der Zufallstoken ist der Berechtigungsnachweis.
 */
export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, cancelTokenSchema.parse)
  return signupByToken(token)
})
