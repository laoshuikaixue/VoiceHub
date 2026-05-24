import { defineEventHandler } from 'h3'
import { setStore } from '~~/server/utils/captchaStore'
import svgCaptcha from 'svg-captcha'

export default defineEventHandler(async () => {
  const captcha = svgCaptcha.create({
    size: 4,               // 4 位字符
    ignoreChars: '0o1il',  // 剔除易混淆字符
    noise: 1,               // 干扰线从2减到1，减少视觉杂乱
    color: true,           // 彩色字符
    background: '#ffffff',  // 浅白背景，提高对比度
    width: 120,             // 显式指定宽度，让SVG适配容器
    height: 40              // 显式指定高度
  })

  const captchaId = crypto.randomUUID()
  // 存入统一存储，5 分钟有效
  await setStore(`captcha:${captchaId}`, captcha.text.toLowerCase(), 300)

  return {
    id: captchaId,
    svg: captcha.data      // 完整的 <svg>...</svg> 字符串
  }
})
