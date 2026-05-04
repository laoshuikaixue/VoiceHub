/**
 * 图形验证码校验与销毁
 * 纯内存实现，无需 Redis
 */
import { CAPTCHA_CODE_EXPIRE } from '~~/server/config/constants'

interface CaptchaRecord {
  text: string
  expiresAt: number
}

const captchaStore = new Map<string, CaptchaRecord>()

// 每 2 分钟清理过期验证码
setInterval(() => {
  const now = Date.now()
  for (const [id, record] of captchaStore.entries()) {
    if (record.expiresAt <= now) captchaStore.delete(id)
  }
}, 2 * 60 * 1000)

/** 保存验证码 */
export function saveCaptcha(id: string, text: string) {
  captchaStore.set(id, {
    text,
    expiresAt: Date.now() + CAPTCHA_CODE_EXPIRE * 1000
  })
}

/** 只校验验证码是否正确，不删除 */
export async function verifyCaptcha(captchaId: string, userInput: string): Promise<boolean> {
  if (!captchaId || !userInput) return false
  const record = captchaStore.get(captchaId)
  if (!record) return false
  if (Date.now() > record.expiresAt) {
    captchaStore.delete(captchaId)
    return false
  }
  return record.text === String(userInput).toLowerCase()
}

/** 仅删除验证码，不校验 */
export async function consumeCaptcha(captchaId: string): Promise<void> {
  captchaStore.delete(captchaId)
}

/** 校验并立即销毁验证码（兼容旧逻辑，本需求中不再使用） */
export async function verifyAndConsumeCaptcha(captchaId: string, userInput: string): Promise<boolean> {
  const isValid = await verifyCaptcha(captchaId, userInput)
  if (isValid) {
    await consumeCaptcha(captchaId)
  }
  return isValid
}
