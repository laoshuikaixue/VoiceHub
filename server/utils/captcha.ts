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

/** 保存验证码，有效期由常量控制 */
export function saveCaptcha(id: string, text: string) {
  captchaStore.set(id, {
    text,
    expiresAt: Date.now() + CAPTCHA_CODE_EXPIRE * 1000
  })
}

/** 验证并销毁验证码（一次性使用） */
export async function verifyAndConsumeCaptcha(
  captchaId: string,
  userInput: string
): Promise<boolean> {
  const record = captchaStore.get(captchaId)
  if (!record) return false

  // 立即删除，防止重放攻击
  captchaStore.delete(captchaId)

  // 检查是否过期
  if (Date.now() > record.expiresAt) return false

  return record.text === String(userInput).toLowerCase()
}
