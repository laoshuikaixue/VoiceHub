import { getRequestHeader, readBody } from 'h3'
import { seal } from '~~/server/utils/music-source-plugins/tickets'
import { resolveCaptchaSettings } from '~~/server/services/securityService'
import { getRequestHostname } from '~~/server/utils/request-utils'
import { resolveEsaCaptchaSceneId } from '~/utils/esaCaptcha'
import { createApiError } from '~~/server/utils/apiError'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { getClientIP } from '~~/server/utils/ip-utils'
import {
  SERVER_ERROR_CODES,
  ALIYUN_ESA_CAPTCHA_VERIFY_HEADER,
  ESA_CAPTCHA_PASS_TICKET_PURPOSE,
  ESA_CAPTCHA_PASS_TICKET_TTL
} from '~~/server/config/constants'

// 凭证可服务的业务接口（与各业务接口的校验分支一一对应）
const ESA_PASS_PURPOSES = ['login', 'register', 'forgot_password', 'email_code'] as const

// 单 IP 签发频率限制，遏制直连源站时的凭证批量获取
const VERIFY_RATE_LIMIT = 60
const VERIFY_RATE_WINDOW_MS = 10 * 60 * 1000

/**
 * ESA AI 验证码公共验证接口。
 *
 * ESA 控制台按域名对 /api/captcha/verify 建规则，边缘对 captcha-verify-param 头完成验签后
 * 请求才会到达源站；源站据此签发短期密封凭证（seal/unseal，无状态、多实例安全），
 * 供 login/register 等接口校验，实现一次验证全局复用。
 * 前提：源站必须只接受 ESA 回源流量，否则直连本接口附带任意验签参数即可骗取凭证。
 */
export default defineEventHandler(async (event) => {
  const clientIp = getClientIP(event)
  const limitResult = await checkDistributedRateLimit(
    `esa_captcha_verify:${clientIp}`,
    VERIFY_RATE_LIMIT,
    VERIFY_RATE_WINDOW_MS
  )
  if (!limitResult.isAllowed) {
    const waitMinutes = Math.ceil((limitResult.resetTime - getServerTimestamp()) / 60000)
    throw createApiError(
      429,
      SERVER_ERROR_CODES.AUTH_RATE_LIMITED_MINUTES,
      `人机验证过于频繁，请等待 ${waitMinutes} 分钟后再试`,
      { params: [waitMinutes] }
    )
  }

  const captchaSettings = await resolveCaptchaSettings()
  if (!captchaSettings.enabled || captchaSettings.provider !== 'esa') {
    return { required: false }
  }

  // 当前域名解析不到可用场景 ID 时边缘不会拦截，视为未开启人机验证，与前后端降级判据一致
  const host = getRequestHostname(event)
  const esaSceneId = resolveEsaCaptchaSceneId(captchaSettings.esaScenes, 'common', host)
  if (!esaSceneId) {
    return { required: false }
  }

  const verifyParam = getRequestHeader(event, ALIYUN_ESA_CAPTCHA_VERIFY_HEADER)
  if (!verifyParam) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_REQUIRED, '请完成人机验证', {
      captchaRequired: true,
      captchaProvider: 'esa'
    })
  }

  const body = await readBody(event).catch(() => null)
  const purpose = body?.purpose
  if (!ESA_PASS_PURPOSES.includes(purpose)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '凭证用途参数无效')
  }

  const passToken = seal({ purpose, issuedHost: host }, ESA_CAPTCHA_PASS_TICKET_PURPOSE, ESA_CAPTCHA_PASS_TICKET_TTL)
  return { required: true, passToken, expiresIn: Math.floor(ESA_CAPTCHA_PASS_TICKET_TTL / 1000) }
})
