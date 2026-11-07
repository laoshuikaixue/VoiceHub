import { db } from '~/drizzle/db'
import { notificationSettings, users } from '~/drizzle/schema'
import { and, eq, inArray, isNotNull, ne } from 'drizzle-orm'
import { getSiteTitle } from '~~/server/utils/siteUtils'

const MEOW_API_BASE = 'https://api.chuckfang.com'
/** MeoW 自定义分类名，去除首尾空白后最多 10 个字 */
const MEOW_CATEGORY = 'VoiceHub'

export interface MeowSendResult {
  ok: boolean
  /** 业务状态码：400 参数错误、403 内容策略、404 昵称未注册、429 频率超限、500 服务器错误 */
  bizStatus?: number
  msg?: string
}

/**
 * 发送 MeoW 通知（POST JSON）
 * MeoW 的 HTTP 响应状态统一为 200，成败必须读响应 JSON 的 status 字段
 */
export async function sendMeowNotification(
  meowNickname: string,
  title: string,
  message: string,
  url?: string
): Promise<MeowSendResult> {
  try {
    const response = await fetch(`${MEOW_API_BASE}/${encodeURIComponent(meowNickname)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceHub-Notification-Service'
      },
      body: JSON.stringify({
        title,
        msg: message,
        ...(url ? { url } : {}),
        category: MEOW_CATEGORY
      })
    })

    if (!response.ok) {
      console.error('MeoW 推送 HTTP 请求失败:', response.status, response.statusText)
      return { ok: false }
    }

    const result = await response.json().catch(() => null)
    if (result?.status === 200) {
      return { ok: true, bizStatus: 200, msg: result.msg }
    }

    console.error('MeoW 推送失败:', result?.status, result?.msg)
    return { ok: false, bizStatus: result?.status, msg: result?.msg }
  } catch (error) {
    console.error('发送 MeoW 通知时出错:', error)
    return { ok: false }
  }
}

/**
 * 为用户发送 MeoW 通知（如果已绑定）
 */
export async function sendMeowNotificationToUser(
  userId: number,
  notificationTitle: string,
  notificationMessage: string,
  url?: string
): Promise<boolean> {
  try {
    // 获取用户信息
    const userResult = await db
      .select({
        name: users.name,
        meowNickname: users.meowNickname,
        id: users.id
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const user = userResult[0]

    // 获取用户通知设置
    let userNotificationSettings = null
    if (user) {
      const settingsResult = await db
        .select({
          enabled: notificationSettings.enabled
        })
        .from(notificationSettings)
        .where(eq(notificationSettings.userId, userId))
        .limit(1)
      userNotificationSettings = settingsResult[0]
    }

    // 检查用户是否绑定了 MeoW 账号
    if (!user?.meowNickname) {
      return false
    }

    // 检查用户是否启用了通知
    if (userNotificationSettings && !userNotificationSettings.enabled) {
      return false
    }

    // 检查是否有其他用户绑定了相同的 MeoW ID
    const usersWithSameMeowId = await db
      .select({
        name: users.name
      })
      .from(users)
      .where(and(eq(users.meowNickname, user.meowNickname!), ne(users.id, userId)))

    // 获取站点标题
    const siteTitle = await getSiteTitle()

    // 构建完整的通知标题
    const fullTitle = `${notificationTitle} | ${siteTitle}通知推送`

    // 如果有多个用户绑定了相同的 MeoW ID，在消息中加上用户名备注
    let enhancedMessage = notificationMessage
    if (usersWithSameMeowId.length > 0) {
      // 检查消息是否以"您"开头，如果是则替换，否则添加前缀
      if (notificationMessage.startsWith('您')) {
        enhancedMessage = `您（${user.name}）${notificationMessage.substring(1)}`
      } else {
        enhancedMessage = `您（${user.name}）${notificationMessage}`
      }
    }

    // 发送 MeoW 通知
    const sendResult = await sendMeowNotification(user.meowNickname, fullTitle, enhancedMessage, url)
    return sendResult.ok
  } catch (error) {
    console.error('发送用户 MeoW 通知失败:', error)
    return false
  }
}

/**
 * 批量发送 MeoW 通知
 */
export async function sendBatchMeowNotifications(
  userIds: number[],
  notificationTitle: string,
  notificationMessage: string,
  url?: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  // 获取所有绑定了 MeoW 的用户
  const usersWithMeow = await db
    .select({
      id: users.id,
      name: users.name,
      meowNickname: users.meowNickname
    })
    .from(users)
    .where(and(inArray(users.id, userIds), isNotNull(users.meowNickname)))

  // 获取这些用户的通知设置
  const userNotificationSettingsMap = new Map()
  if (usersWithMeow.length > 0) {
    const settingsResults = await db
      .select({
        userId: notificationSettings.userId,
        enabled: notificationSettings.enabled
      })
      .from(notificationSettings)
      .where(
        inArray(
          notificationSettings.userId,
          usersWithMeow.map((u) => u.id)
        )
      )

    settingsResults.forEach((setting) => {
      userNotificationSettingsMap.set(setting.userId, setting)
    })
  }

  // 获取站点标题
  const siteTitle = await getSiteTitle()
  const fullTitle = `${notificationTitle} | ${siteTitle}通知推送`

  // 统计每个 MeoW ID 绑定的用户数量
  const meowIdCounts = new Map<string, number>()
  usersWithMeow.forEach((user) => {
    const count = meowIdCounts.get(user.meowNickname!) || 0
    meowIdCounts.set(user.meowNickname!, count + 1)
  })

  // 按 MeoW ID 分组合并：一个 ID 绑定多个账号时只推送一次，避免触发每昵称 3 秒 1 条限流
  const groupMap = new Map<string, string[]>()
  usersWithMeow.forEach((user) => {
    // 关闭通知的用户计入失败，保持统计口径不变
    const userSettings = userNotificationSettingsMap.get(user.id)
    if (userSettings && !userSettings.enabled) {
      failed++
      return
    }

    // 如果该 MeoW ID 绑定了多个用户，在消息中加上用户名备注
    let enhancedMessage = notificationMessage
    const userCount = meowIdCounts.get(user.meowNickname!)
    if (userCount && userCount > 1) {
      // 检查消息是否以"您"开头，如果是则替换，否则添加前缀
      if (notificationMessage.startsWith('您')) {
        enhancedMessage = `您（${user.name}）${notificationMessage.substring(1)}`
      } else {
        enhancedMessage = `您（${user.name}）${notificationMessage}`
      }
    }

    const messages = groupMap.get(user.meowNickname!)
    if (messages) {
      messages.push(enhancedMessage)
    } else {
      groupMap.set(user.meowNickname!, [enhancedMessage])
    }
  })

  const groups = [...groupMap.entries()].map(([nickname, messages]) => ({
    nickname,
    message: messages.join('\n'),
    userCount: messages.length
  }))

  // 并发发送通知（限制并发数），按用户数计成功/失败
  const batchSize = 5
  for (let i = 0; i < groups.length; i += batchSize) {
    const batch = groups.slice(i, i + batchSize)

    const promises = batch.map(async (group) => {
      const result = await sendMeowNotification(group.nickname, fullTitle, group.message, url)
      return { ok: result.ok, userCount: group.userCount }
    })

    const results = await Promise.allSettled(promises)

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.ok) {
        success += result.value.userCount
      } else {
        failed += result.status === 'fulfilled' ? result.value.userCount : 1
      }
    })
  }

  return { success, failed }
}
