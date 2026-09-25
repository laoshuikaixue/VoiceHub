import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { notificationSettings, users } from '~/drizzle/schema'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { ASTRBOT_TOKEN_HEADER, normalizeAstrbotBaseUrl } from '~~/server/utils/astrbot-notification'

/** 仅在单次请求内投递，超时并记录错误；不依赖进程内队列或后台定时器。 */
export async function postAstrbotNotification(
  umos: string[], title: string, content: string, group = false
): Promise<{ sent: number; failed: number }> {
  const settings = await getSystemSettingsCached()
  const baseUrl = normalizeAstrbotBaseUrl(settings?.astrbotBaseUrl)
  if (!settings?.astrbotEnabled || !settings.astrbotToken || !baseUrl || (!umos.length && !group)) {
    return { sent: 0, failed: 0 }
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
      signal: controller.signal
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
  const result = await postAstrbotNotification([user.umo], title, content)
  return result.sent > 0
}

export async function sendBatchAstrbotNotifications(userIds: number[], title: string, content: string, broadcast = false) {
  const settings = await getSystemSettingsCached()
  if (!settings?.astrbotEnabled) return { success: 0, failed: 0 }
  const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))]
  const rows = uniqueIds.length ? await db.select({ umo: users.astrbotUmo, enabled: notificationSettings.enabled })
    .from(users)
    .leftJoin(notificationSettings, eq(notificationSettings.userId, users.id))
    .where(and(inArray(users.id, uniqueIds), isNotNull(users.astrbotUmo))) : []
  const umos = rows.filter((row) => row.enabled !== false && !!row.umo).map((row) => row.umo!)
  let success = 0
  let failed = 0
  // 插件单次请求最多接收 200 个目标；广播只随第一批发送一次。
  const chunks = [] as string[][]
  const shouldBroadcast = broadcast && !!settings.astrbotBroadcastEnabled
  if (!shouldBroadcast && !umos.length) return { success: 0, failed: 0 }
  for (let i = 0; i < umos.length; i += 200) chunks.push(umos.slice(i, i + 200))
  if (shouldBroadcast && chunks.length && chunks[0]!.length === 200) {
    chunks.unshift([])
  }
  if (!chunks.length && shouldBroadcast) chunks.push([])
  for (const [index, chunk] of chunks.entries()) {
    try {
      const result = await postAstrbotNotification(chunk, title, content,
        index === 0 && shouldBroadcast)
      success += result.sent
      failed += result.failed
    } catch (error) {
      failed += chunk.length
      console.error('批量发送 AstrBot 通知失败:', error)
    }
  }
  return { success, failed }
}
