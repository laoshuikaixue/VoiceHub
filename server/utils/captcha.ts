/**
 * 图形验证码校验与销毁
 * 统一使用 captchaStore（Redis 或内存 Map），与 /api/auth/captcha 生成接口共享存储。
 *
 * 注意：生成端写入的 key 形如 `captcha:<id>`，本文件必须使用相同前缀，
 * 否则会出现"验证码输对了仍不通过"的问题。
 */
import { getStore, delStore, setStore, getAndDelStore } from './captchaStore'

const keyOf = (id: string) => `captcha:${id}`
// 与生成端保持一致：5 分钟有效
const CAPTCHA_TTL_SECONDS = 300

/** 保存验证码（保留以兼容直接调用此函数的旧代码） */
export async function saveCaptcha(id: string, text: string) {
  await setStore(keyOf(id), String(text).toLowerCase(), CAPTCHA_TTL_SECONDS)
}

/** 只校验验证码是否正确，不删除 */
export async function verifyCaptcha(captchaId: string, userInput: string): Promise<boolean> {
  if (!captchaId || !userInput) return false
  const stored = await getStore(keyOf(captchaId))
  if (!stored) return false
  return stored === String(userInput).toLowerCase()
}

/** 仅删除验证码，不校验 */
export async function consumeCaptcha(captchaId: string): Promise<void> {
  if (!captchaId) return
  await delStore(keyOf(captchaId))
}

/** 校验并立即销毁验证码（无论成功与否均销毁） */
export async function verifyAndConsumeCaptcha(captchaId: string, userInput: string): Promise<boolean> {
  if (!captchaId || !userInput) return false
  const stored = await getAndDelStore(keyOf(captchaId))
  if (!stored) return false
  return stored === String(userInput).toLowerCase()
}
