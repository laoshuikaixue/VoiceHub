import type { H3Event } from 'h3'
import type { CaptchaSettings } from '~~/server/services/securityService'
import { verifyAndConsumeCaptcha } from './captcha'
import { verifyEsaCaptchaPass } from './esa-captcha-pass'
import { createApiError } from './apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 凭证可服务的业务接口用途（与 captcha/verify 的签发用途一一对应）
export type RequestCaptchaPurpose = 'login' | 'register' | 'forgot_password' | 'email_code'

interface AssertCaptchaParams {
  settings: CaptchaSettings
  body: Record<string, any>
  clientIp: string
  purpose: RequestCaptchaPurpose
  required: boolean
}

/**
 * 统一的人机验证校验（图形 / Turnstile / 阿里云 ESA）。
 * settings.enabled 为 false 或 required 为 false 时直接放行；否则按 provider 校验，失败抛 createApiError。
 */
export async function assertRequestCaptchaPassed(
  event: H3Event,
  { settings, body, clientIp, purpose, required }: AssertCaptchaParams
): Promise<void> {
  if (!settings.enabled || !required) return

  if (settings.provider === 'turnstile') {
    const turnstileToken = body?.turnstileToken

    if (!settings.turnstileSecretKey) {
      throw createApiError(500, SERVER_ERROR_CODES.AUTH_CAPTCHA_SERVICE_UNAVAILABLE, '验证码服务配置错误，请联系管理员')
    }

    if (!turnstileToken) {
      throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_REQUIRED, '请完成人机验证', { captchaRequired: true, captchaProvider: 'turnstile' })
    }

    const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    const formData = new URLSearchParams()
    formData.append('secret', settings.turnstileSecretKey)
    formData.append('response', turnstileToken)
    formData.append('remoteip', clientIp)

    try {
      const result: any = await $fetch(verifyUrl, {
        method: 'POST',
        body: formData,
        timeout: 5000
      })

      if (!result.success) {
        console.error('Turnstile verification failed:', result['error-codes'])
        throw createApiError(400, SERVER_ERROR_CODES.AUTH_CAPTCHA_FAILED_OR_EXPIRED, '人机验证失败或已过期，请重试', { captchaRequired: true, captchaProvider: 'turnstile' })
      }
    } catch (err: any) {
      if (err.statusCode === 400) throw err
      console.error('Turnstile verification error:', err)
      throw createApiError(500, SERVER_ERROR_CODES.AUTH_CAPTCHA_SERVICE_UNAVAILABLE, '人机验证服务暂时不可用')
    }
  } else if (settings.provider === 'esa') {
    // ESA 验签在边缘对公共验证接口 /api/captcha/verify 完成，通过后源站签发短期凭证；
    // 此处校验凭证（绑定用途与签发域名）。当前域名无可用场景 ID 时视为未开启人机验证，不拦截
    verifyEsaCaptchaPass(event, settings.esaScenes, purpose)
  } else {
    const captchaId = body?.captchaId
    const captchaInput = body?.captchaInput
    if (!captchaId || !captchaInput) {
      throw createApiError(400, SERVER_ERROR_CODES.AUTH_IMAGE_CAPTCHA_REQUIRED, '请完成图形验证码', { captchaRequired: true, captchaProvider: 'graphic' })
    }

    const isValid = await verifyAndConsumeCaptcha(captchaId, captchaInput)
    if (!isValid) {
      throw createApiError(400, SERVER_ERROR_CODES.AUTH_CODE_INVALID_OR_EXPIRED, '验证码错误或已过期，请重新输入', { captchaRequired: true, captchaProvider: 'graphic' })
    }
  }
}
