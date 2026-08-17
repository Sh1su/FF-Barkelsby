import { cancelTokenSchema } from '../../../shared/validation/signup'
import { cancelSignupByToken } from '../../services/signup.service'

/** Selbstabmeldung über den Link aus der E-Mail (FV-5, AC-8). */
export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, cancelTokenSchema.parse)
  return cancelSignupByToken(token)
})
