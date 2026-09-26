import { eq, inArray } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, notificationSettings } from '~/drizzle/schema'
import { selectAstrbotTargets } from '~~/server/utils/astrbot-platforms'
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
  if (!settings?.astrbotEnabled || !settings.astrbotToken || !baseUrl || !umos.length) {
    return { sent: 0, failed: 0 }
  }
  const bindings = umos.length ? await db.select().from(astrbotBindings).where(inArray(astrbotBindings.umo, umos)) : []
  const valid = new Set(selectAstrbotTargets(bindings, settings.astrbotPlatforms))
  const confirmed = [...new Set(umos)].filter((umo) => valid.has(umo))
  if (!confirmed.length && !group) return { sent: 0, failed: umos.length }

  if (!fitsAstrbotPayload(confirmed, title, content, group)) {
    throw new Error('AstrBot 推送请求超过大小限制')
  }

  const targets = { umo: confirmed, group }
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
    return { sent: result.sent, failed: umos.length - confirmed.length + (Array.isArray(result.failed) ? result.failed.length : 0) }
  } finally {
    clearTimeout(timer)
  }
}

export async function sendAstrbotNotificationToUser(userId: number, title: string, content: string) {
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) return false
  const rows = await db.select().from(astrbotBindings).where(eq(astrbotBindings.userId, userId))
  const umos = selectAstrbotTargets(rows, settings.astrbotPlatforms)
  if (!umos.length) return false
  const [setting] = await db.select({ enabled: notificationSettings.enabled }).from(notificationSettings)
    .where(eq(notificationSettings.userId, userId)).limit(1)
  if (setting && !setting.enabled) return false
  // pull 模式：入队即视为已受理，实际投递由插件领取后完成。
  if (await isPullMode()) {
    const queued = await enqueueAstrbotNotifications([userId], title, content)
    return queued > 0
  }
  const result = await postAstrbotNotification(umos, title, content)
  return result.sent > 0
}

export async function sendBatchAstrbotNotifications(userIds: number[], title: string, content: string) {
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) return { success: 0, failed: 0 }
  // pull 模式：通知只入队，由插件按轮询周期领取投递。
  if (settings.astrbotPushMode === 'pull') {
    const queued = await enqueueAstrbotNotifications(userIds, title, content)
    return { success: queued, failed: 0, queued }
  }
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))]
  const rows = uniqueIds.length ? await db.select({ umo: astrbotBindings.umo, adapter: astrbotBindings.adapter, platform: astrbotBindings.platform, enabled: notificationSettings.enabled })
    .from(astrbotBindings)
    .leftJoin(notificationSettings, eq(notificationSettings.userId, astrbotBindings.userId))
    .where(inArray(astrbotBindings.userId, uniqueIds)) : []
  const umos = selectAstrbotTargets(rows, settings.astrbotPlatforms)
  let success = 0
  let failed = 0
  // 群广播没有目标绑定，无法证明其平台归属，拒绝跨平台广播：只投递已绑定的私聊会话。
  if (!umos.length) return { success: 0, failed: 0 }
  // 正文本身超出插件请求体上限时无法投递任何目标；这里按失败计数返回并明确记录，
  // 避免调用方只看到“通知发送成功”而机器人推送其实被静默丢弃。
  if (!fitsAstrbotPayload([], title, content, false)) {
    console.error('AstrBot 推送已跳过：通知正文超过单次请求大小限制')
    return { success: 0, failed: Math.max(umos.length, 1) }
  }
  const { chunks, skipped } = chunkAstrbotTargets(umos, title, content)
  failed += skipped
  for (const chunk of chunks) {
    try {
      const result = await postAstrbotNotification(chunk, title, content, false)
      success += result.sent
      failed += result.failed
    } catch (error) {
      failed += chunk.length
      console.error('批量发送 AstrBot 通知失败:', error)
    }
  }
  return { success, failed }
}
