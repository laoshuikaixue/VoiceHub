import { getAndDelStore } from './captchaStore'

/**
 * 验证图形验证码，成功时自动销毁，不允许重用。
 * @param captchaId 前端传来的 captchaId
 * @param userInput 用户输入的验证码字符串
 * @returns true 表示验证码正确
 */
export async function verifyAndConsumeCaptcha(
  captchaId: string,
  userInput: string
): Promise<boolean> {
  if (!captchaId || !userInput) return false
  const savedText = await getAndDelStore(`captcha:${captchaId}`)
  if (!savedText) return false
  return savedText === String(userInput).toLowerCase()
}
