import { defineEventHandler } from 'h3'
import { setStore } from '~~/server/utils/captchaStore'
import svgCaptcha from 'svg-captcha'

export default defineEventHandler(async () => {
  const captcha = svgCaptcha.create({
    size: 4,               // 4 位字符
    ignoreChars: '0o1il',  // 剔除易混淆字符
    noise: 2,              // 干扰线条数
    color: true,           // 彩色字符
    background: '#f9fafb'   // 浅灰背景，配合 Tailwind
  })

  const captchaId = crypto.randomUUID()
  // 存入统一存储，5 分钟有效
  await setStore(`captcha:${captchaId}`, captcha.text.toLowerCase(), 300)

  return {
    id: captchaId,
    svg: captcha.data      // 完整的 <svg>...</svg> 字符串
  }
})
