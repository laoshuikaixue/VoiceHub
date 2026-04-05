export const OAUTH_REGISTER_USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export const validateOAuthRegisterCredentials = (
  username: string,
  password: string,
  confirmPassword: string
): string | null => {
  if (username.length < 3 || username.length > 30) {
    return '用户名长度需要在3-30个字符之间'
  }

  if (!OAUTH_REGISTER_USERNAME_PATTERN.test(username)) {
    return '用户名仅可包含英文、数字、下划线和连字符'
  }

  if (password.length < 8) {
    return '密码长度至少为8个字符'
  }

  if (password !== confirmPassword) {
    return '两次输入的密码不一致'
  }

  return null
}