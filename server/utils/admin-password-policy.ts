import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '~/utils/password-policy'

interface AdminPasswordViolation {
  code: string
  message: string
}

/**
 * 管理员重置/设置临时密码的基础校验。
 * 临时密码配合 forceReset 强制用户登录后自行修改，故不要求完整复杂度，
 * 但仍需拦截空密码、过短易爆破密码、超长密码及超出 bcrypt 72 字节有效范围的输入。
 */
export function getAdminPasswordViolation(password: unknown): AdminPasswordViolation | null {
  if (typeof password !== 'string' || !password) {
    return { code: 'AUTH_NEW_PASSWORD_REQUIRED', message: '新密码不能为空' }
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      code: 'AUTH_PASSWORD_TOO_SHORT',
      message: `密码长度不能少于${PASSWORD_MIN_LENGTH}个字符`
    }
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      code: 'AUTH_PASSWORD_TOO_LONG',
      message: `密码长度不能超过${PASSWORD_MAX_LENGTH}位`
    }
  }

  if (new TextEncoder().encode(password).length > 72) {
    return {
      code: 'AUTH_PASSWORD_TOO_MANY_BYTES',
      message: '密码有效长度不能超过72字节'
    }
  }

  return null
}
