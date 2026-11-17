/**
 * 敏感操作二次验证（step-up）：凭据校验通过后，在短窗口内允许执行对应 reason 的特权操作。
 *
 * 窗口按 reason + 用户 + 会话三元组存放于 captchaStore（配置 Redis 时跨实例共享，
 * 未配置时为进程内存），不接受任何客户端持有的特权令牌，跨会话无法复用。
 * reason 为封闭白名单，新增敏感操作只需在此追加一项并在目标端点调用 requireStepUp。
 */
import type { H3Event } from 'h3'
import { delStore, getStore, hashStateCode, setStore } from './captchaStore'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

export const STEP_UP_REASONS = {
  // 授予或撤销超级管理员身份
  'super-admin-role': { ttlSeconds: 300 }
} as const

export type StepUpReason = keyof typeof STEP_UP_REASONS

export const STEP_UP_TOTP_FAILURE_LIMIT = 5
export const STEP_UP_TOTP_FAILURE_WINDOW_SECONDS = 300

export function isStepUpReason(reason: unknown): reason is StepUpReason {
  return typeof reason === 'string' && Object.hasOwn(STEP_UP_REASONS, reason)
}

export function stepUpTtl(reason: StepUpReason): number {
  return STEP_UP_REASONS[reason].ttlSeconds
}

function windowKey(event: H3Event, reason: StepUpReason): string {
  const user = event.context.user
  return `step-up:${reason}:${user.id}:${user.sessionId ?? 'none'}`
}

// 签发窗口；写入值为 HMAC 指纹，避免其他请求用可预测内容伪造
export async function issueStepUpWindow(event: H3Event, reason: StepUpReason): Promise<number> {
  const ttl = stepUpTtl(reason)
  await setStore(windowKey(event, reason), hashStateCode('step-up', windowKey(event, reason)), ttl)
  return ttl
}

export async function clearStepUpWindow(event: H3Event, reason: StepUpReason): Promise<void> {
  await delStore(windowKey(event, reason))
}

export async function hasStepUpWindow(event: H3Event, reason: StepUpReason): Promise<boolean> {
  const key = windowKey(event, reason)
  const stored = await getStore(key)
  return !!stored && stored === hashStateCode('step-up', key)
}

// 特权端点入口校验；窗口缺失时要求重新验证凭据，用 403 避免前端按登录失效全局登出
export async function requireStepUp(event: H3Event, reason: StepUpReason): Promise<void> {
  if (await hasStepUpWindow(event, reason)) return
  throw createApiError(
    403,
    SERVER_ERROR_CODES.PERMISSION_STEP_UP_REQUIRED,
    '该操作需要重新验证当前账号凭据'
  )
}
