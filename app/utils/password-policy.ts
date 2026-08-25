const COMMON_PASSWORDS = new Set([
  '12345678',
  'password',
  'password123',
  'qwertyui',
  'qwerty123',
  'admin123',
  'admin123456',
  '11111111',
  '00000000',
  'abc12345',
  'iloveyou',
  'letmein',
  'welcome',
  'voicehub'
])

export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 128
export const INITIAL_PASSWORD_MIN_CLASSES = 2

export interface PasswordPolicyOptions {
  minClasses?: number
  complexityCode?: string
}

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

const INITIAL_PASSWORD_POLICY_OPTIONS: PasswordPolicyOptions = {
  minClasses: INITIAL_PASSWORD_MIN_CLASSES,
  complexityCode: 'AUTH_INITIAL_PASSWORD_COMPLEXITY_REQUIRED'
}

export function getPasswordPolicyViolation(password: unknown, options: PasswordPolicyOptions = {}) {
  const minClasses = options.minClasses ?? 3
  const complexityCode = options.complexityCode ?? 'AUTH_PASSWORD_COMPLEXITY_REQUIRED'

  if (typeof password !== 'string' || !password) {
    return { code: 'AUTH_NEW_PASSWORD_REQUIRED', message: '密码不能为空' }
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      code: 'AUTH_PASSWORD_TOO_SHORT',
      message: `密码长度至少为${PASSWORD_MIN_LENGTH}位`
    }
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      code: 'AUTH_PASSWORD_TOO_LONG',
      message: `密码长度不能超过${PASSWORD_MAX_LENGTH}位`
    }
  }

  // bcrypt 只处理前 72 字节，拒绝超出范围的输入，避免用户以为完整密码参与校验。
  if (getUtf8ByteLength(password) > 72) {
    return {
      code: 'AUTH_PASSWORD_TOO_MANY_BYTES',
      message: '密码有效长度不能超过72字节'
    }
  }

  const normalized = password.toLowerCase().replace(/\s+/g, '')
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      code: 'AUTH_PASSWORD_TOO_COMMON',
      message: '该密码过于常见，请更换更安全的密码'
    }
  }

  const categories = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length

  if (categories < minClasses) {
    return {
      code: complexityCode,
      message: `密码至少需要包含大写字母、小写字母、数字、特殊字符中的${minClasses === 2 ? '两' : '三'}类`
    }
  }

  return null
}

export function getInitialPasswordPolicyViolation(password: unknown) {
  return getPasswordPolicyViolation(password, INITIAL_PASSWORD_POLICY_OPTIONS)
}

export function validatePasswordPolicy(password: unknown): string | null {
  return getPasswordPolicyViolation(password)?.message ?? null
}

export function validateInitialPasswordPolicy(password: unknown): string | null {
  return getInitialPasswordPolicyViolation(password)?.message ?? null
}
