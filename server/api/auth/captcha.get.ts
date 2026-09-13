import { defineEventHandler } from 'h3'
import { saveCaptcha } from '~~/server/utils/captcha'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { getClientIP } from '~~/server/utils/ip-utils'
import svgCaptcha from 'svg-captcha'

// 单 IP 取码频率限制，遏制自动化批量取码
const CAPTCHA_FETCH_LIMIT = 100
const CAPTCHA_FETCH_WINDOW_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const clientIp = getClientIP(event)
  const limitResult = await checkDistributedRateLimit(
    `captcha_fetch:${clientIp}`,
    CAPTCHA_FETCH_LIMIT,
    CAPTCHA_FETCH_WINDOW_MS
  )
  if (!limitResult.isAllowed) {
    const waitMinutes = Math.ceil((limitResult.resetTime - getServerTimestamp()) / 60000)
    throw createApiError(
      429,
      SERVER_ERROR_CODES.AUTH_RATE_LIMITED_MINUTES,
      `获取验证码过于频繁，请等待 ${waitMinutes} 分钟后再试`,
      { params: [waitMinutes] }
    )
  }

  const captcha = svgCaptcha.create({
    size: 4, // 4 位字符
    ignoreChars: '0o1il', // 剔除易混淆字符
    noise: 1, // 干扰线从2减到1，减少视觉杂乱
    color: true, // 彩色字符
    background: '#ffffff', // 浅白背景，提高对比度
    width: 120, // 显式指定宽度，让SVG适配容器
    height: 40 // 显式指定高度
  })

  const captchaId = crypto.randomUUID()
  // 存入统一存储，5 分钟有效
  await saveCaptcha(captchaId, captcha.text)

  return {
    id: captchaId,
    svg: captcha.data // 完整的 <svg>...</svg> 字符串
  }
})
