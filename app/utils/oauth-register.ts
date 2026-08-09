import { getPasswordPolicyViolation } from './password-policy'

// OAuth 注册用户名规则
export const OAUTH_REGISTER_USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/
export const OAUTH_REGISTER_USERNAME_MIN_LENGTH = 3
export const OAUTH_REGISTER_USERNAME_MAX_LENGTH = 30

// 校验 OAuth 注册凭据，返回稳定错误码与中文兜底文案；通过时返回 null。
// 不依赖 useLocale，前端与服务端可安全共用；文案本地化由调用方按 code 完成。
export const validateOAuthRegisterCredentials = (
  username: string,
  password: string,
  confirmPassword: string
): { code: string; message: string } | null => {
  if (
    username.length < OAUTH_REGISTER_USERNAME_MIN_LENGTH ||
    username.length > OAUTH_REGISTER_USERNAME_MAX_LENGTH
  ) {
    return { code: 'AUTH_USERNAME_LENGTH_INVALID', message: '用户名长度需要在3-30个字符之间' }
  }

  if (!OAUTH_REGISTER_USERNAME_PATTERN.test(username)) {
    return { code: 'AUTH_USERNAME_PATTERN_INVALID', message: '用户名仅可包含英文、数字、下划线和连字符' }
  }

  const passwordViolation = getPasswordPolicyViolation(password)
  if (passwordViolation) {
    return passwordViolation
  }

  if (password !== confirmPassword) {
    return { code: 'AUTH_REGISTER_PASSWORD_MISMATCH', message: '两次输入的密码不一致' }
  }

  return null
}
