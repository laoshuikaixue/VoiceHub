import { getRequestHeader, type H3Event } from 'h3'
import { unseal } from './music-source-plugins/tickets'
import { getRequestHostname } from './request-utils'
import { resolveEsaCaptchaSceneId } from '~/utils/esaCaptcha'
import {
  ALIYUN_ESA_CAPTCHA_PASS_HEADER,
  ESA_CAPTCHA_PASS_TICKET_PURPOSE,
  SERVER_ERROR_CODES
} from '~~/server/config/constants'
import { createApiError } from './apiError'

// 验证通过凭证的服务端校验：当前域名无可用场景 ID 时（边缘不会拦截）直接放行，
// 与前端 resolveEsaCaptchaSceneId 的「未开启人机验证」判据完全一致
export const verifyEsaCaptchaPass = (
  event: H3Event,
  scenes: unknown,
  purpose: 'login' | 'register'
): void => {
  const host = getRequestHostname(event)
  if (!resolveEsaCaptchaSceneId(scenes, 'common', host)) return

  const passHeader = getRequestHeader(event, ALIYUN_ESA_CAPTCHA_PASS_HEADER)
  let payload: { purpose?: string; issuedHost?: string } | null = null
  if (passHeader) {
    try {
      payload = unseal(passHeader, ESA_CAPTCHA_PASS_TICKET_PURPOSE)
    } catch {
      // 伪造/篡改/过期凭证一律视为未通过，回落到要求重新完成人机验证
      payload = null
    }
  }

  // 凭证绑用途与签发域名，错用途或跨域名复用均无效
  if (!payload || payload.purpose !== purpose || payload.issuedHost !== host) {
    throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_REQUIRED, '请完成人机验证', {
      captchaRequired: true,
      captchaProvider: 'esa'
    })
  }
}
