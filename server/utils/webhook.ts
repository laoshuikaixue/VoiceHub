/**
 * Webhook 异步发送（spec [S8] + [S11.3]）
 *
 * 签名规范（spec [S8]）：
 *   - 签名置于 X-Signature: sha256=<hex> 请求头
 *   - body 仅含 event / payload / timestamp
 *   - HMAC-SHA256(secret, `${timestamp}.${body}`)
 *
 * 异步：
 *   - 调用方传入 h3 event，使用 event.waitUntil() 异步发送
 *   - 失败重试 3 次（指数退避 1s / 4s / 16s）
 *   - 失败入 webhook_failures 表
 *
 * 注意：webhook_secret 在 DB 中存的是 bcrypt 哈希，不可还原。
 * 因此 Webhook 发送需要明文 secret —— 创建响应必须一次性返回明文，
 * 接收方需自存明文以重算 HMAC。本工具函数假设调用方传入已解密的明文。
 */

import crypto from 'crypto'
import { db } from '~/drizzle/db'
import { webhookFailures } from '~/drizzle/schema'

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 1000

export type WebhookPayload = {
  event: string
  payload: Record<string, unknown>
  timestamp?: string
}

export function computeSignature(secret: string, timestamp: string, body: string): string {
  return 'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex')
}

/**
 * 同步发送单次（带重试）
 * @returns true=成功；false=所有重试均失败
 */
export async function sendWebhookWithRetry(
  url: string,
  secret: string,
  body: WebhookPayload
): Promise<boolean> {
  const timestamp = body.timestamp ?? new Date().toISOString()
  const bodyText = JSON.stringify({ ...body, timestamp })
  const signature = computeSignature(secret, timestamp, bodyText)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Event': body.event,
          'X-Timestamp': timestamp
        },
        body: bodyText,
        // 5s 超时防止主响应挂起
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) return true
      // 4xx 立即放弃（接收方主动拒绝），5xx 才重试
      if (res.status >= 400 && res.status < 500) {
        await recordFailure(url, bodyText, `HTTP ${res.status}`, attempt)
        return false
      }
    } catch (err: any) {
      // 网络错误 / 超时，继续重试
      if (attempt === MAX_RETRIES) {
        await recordFailure(url, bodyText, err?.message ?? String(err), attempt)
        return false
      }
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_BACKOFF_MS * Math.pow(4, attempt - 1)
      await sleep(delay)
    }
  }

  await recordFailure(url, bodyText, 'all retries exhausted', MAX_RETRIES)
  return false
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function recordFailure(
  url: string,
  payload: string,
  errorMessage: string,
  attempt: number
): Promise<void> {
  try {
    await db.insert(webhookFailures).values({
      apiKeyId: null,
      url,
      payload,
      errorMessage,
      attempt
    })
  } catch (err) {
    console.error('[Webhook] 写入 webhook_failures 失败:', err)
  }
}
