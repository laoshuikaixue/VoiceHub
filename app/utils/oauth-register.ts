import { useLocale } from '~/utils/locale'
import { validatePasswordPolicy } from './password-policy'

export const OAUTH_REGISTER_USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export const validateOAuthRegisterCredentials = (
  username: string,
  password: string,
  confirmPassword: string
): string | null => {
  const { auth } = useLocale()
  const locale = auth.value.loginForm

  if (username.length < 3 || username.length > 30) {
    return locale.usernameLengthInvalid
  }

  if (!OAUTH_REGISTER_USERNAME_PATTERN.test(username)) {
    return locale.usernamePatternInvalid
  }

  const passwordError = validatePasswordPolicy(password)
  if (passwordError) {
    return passwordError
  }

  if (password !== confirmPassword) {
    return locale.registerPasswordMismatch
  }

  return null
}
