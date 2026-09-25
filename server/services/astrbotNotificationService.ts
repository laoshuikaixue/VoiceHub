import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notificationSettings, users } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { ASTRBOT_TOKEN_HEADER, normalizeAstrbotBaseUrl } from '~~/server/utils/astrbot-notification'
import {
  ASTRBOT_PAYLOAD_MAX_BYTES,
  astrbotPayloadBytes,
  chunkAstrbotTargets,
  fitsAstrbotPayload
} from '~~/server/utils/astrbot-payload'
import { enqueueAstrbotNotifications } from '~~/server/services/astrbotOutboxService'

export { ASTRBOT_PAYLOAD_MAX_BYTES, astrbotPayloadBytes, chunkAstrbotTargets, fitsAstrbotPayload }

/** 推送方向为 pull 时通知只入队，由插件主动领取；此处不得再直连插件。 */
async function isPullMode() {
  const settings = await getSystemSettingsCached()
  return settings?.astrbotPushMode === 'pull'
}

/** 仅在单次请求内投递，超时并记录错误；不依赖进程内队列或后台定时器。 */
export async function postAstrbotNotification(
  umos: string[], title: string, content: string, group = false
): Promise<{ sent: number; failed: number }> {
  const settings = await getSystemSettingsCached()
  const baseUrl = normalizeAstrbotBaseUrl(settings?.astrbotBaseUrl)
  if (!settings?.astrbotEnabled || !settings.astrbotToken || !baseUrl || (!umos.length && !group)) {
    return { sent: 0, failed: 0 }
  }

  if (!fitsAstrbotPayload(umos, title, content, group)) {
    throw new Error('AstrBot 推送请求超过大小限制')
  }

  const targets = { umo: [...new Set(umos)], group }
  const url = `${baseUrl}/voicehub/push`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ASTRBOT_TOKEN_HEADER]: settings.astrbotToken },
      body: JSON.stringify({ title, content, targets }),
      signal: controller.signal,
      redirect: 'error'
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result || result.success !== true || typeof result.sent !== 'number') {
      throw new Error(`机器人推送失败: HTTP ${response.status}`)
    }
    return { sent: result.sent, failed: Array.isArray(result.failed) ? result.failed.length : 0 }
  } finally {
    clearTimeout(timer)
  }
}

export async function sendAstrbotNotificationToUser(userId: number, title: string, content: string) {
  const [user] = await db.select({ umo: users.astrbotUmo }).from(users)
    .where(eq(users.id, userId)).limit(1)
  if (!user?.umo) return false
  const [setting] = await db.select({ enabled: notificationSettings.enabled }).from(notificationSettings)
    .where(eq(notificationSettings.userId, userId)).limit(1)
  if (setting && !setting.enabled) return false
  // pull 模式：入队即视为已受理，实际投递由插件领取后完成。
  if (await isPullMode()) {
    const queued = await enqueueAstrbotNotifications([userId], title, content, false)
    return queued > 0
  }
  const result = await postAstrbotNotification([user.umo], title, content)
  return result.sent > 0
}

export async function sendBatchAstrbotNotifications(userIds: number[], title: string, content: string, broadcast = false) {
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) return { success: 0, failed: 0 }
  // pull 模式：通知只入队，由插件按轮询周期领取投递。
  if (settings.astrbotPushMode === 'pull') {
    const queued = await enqueueAstrbotNotifications(userIds, title, content, broadcast)
    return { success: queued, failed: 0, queued }
  }
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))]
  const rows = uniqueIds.length ? await db.select({ umo: users.astrbotUmo, enabled: notificationSettings.enabled })
    .from(users)
    .leftJoin(notificationSettings, eq(notificationSettings.userId, users.id))
    .where(and(inArray(users.id, uniqueIds), isNotNull(users.astrbotUmo))) : []
  const umos = rows.filter((row) => row.enabled !== false && !!row.umo).map((row) => row.umo!)
  let success = 0
  let failed = 0
  const shouldBroadcast = broadcast && !!settings.astrbotBroadcastEnabled
  if (!shouldBroadcast && !umos.length) return { success: 0, failed: 0 }
  // 正文本身超出插件请求体上限时无法投递任何目标；这里按失败计数返回并明确记录，
  // 避免调用方只看到“通知发送成功”而机器人推送其实被静默丢弃。
  if (!fitsAstrbotPayload([], title, content, false)) {
    console.error('AstrBot 推送已跳过：通知正文超过单次请求大小限制')
    return { success: 0, failed: Math.max(umos.length, 1) }
  }
  const { chunks, skipped } = chunkAstrbotTargets(umos, title, content)
  failed += skipped
  if (shouldBroadcast) {
    if (fitsAstrbotPayload([], title, content, true)) chunks.unshift([])
    else failed++
  }
  for (const chunk of chunks) {
    try {
      const result = await postAstrbotNotification(chunk, title, content, shouldBroadcast && chunk.length === 0)
      success += result.sent
      failed += result.failed
    } catch (error) {
      failed += chunk.length || (shouldBroadcast ? 1 : 0)
      console.error('批量发送 AstrBot 通知失败:', error)
    }
  }
  return { success, failed }
}
