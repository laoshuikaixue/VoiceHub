import { db } from '~/drizzle/db'

/**
 * 获取站点标题
 */
async function getSiteTitle(): Promise<string> {
  try {
    const settings = await db.systemSettings.findFirst()
    return settings?.siteTitle || process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub'
  } catch (error) {
    console.error('获取站点标题失败:', error)
    return 'VoiceHub'
  }
}

/**
 * 发送 MeoW 通知
 */
async function sendMeowNotification(
  meowNickname: string, 
  title: string, 
  message: string, 
  url?: string
): Promise<boolean> {
  try {
    // URL 编码参数
    const encodedNickname = encodeURIComponent(meowNickname)
    const encodedTitle = encodeURIComponent(title)
    const encodedMessage = encodeURIComponent(message)
    
    // 构建请求 URL
    let meowUrl = `https://api.chuckfang.com/${encodedNickname}/${encodedTitle}/${encodedMessage}`
    
    if (url) {
      meowUrl += `?url=${encodeURIComponent(url)}`
    }
    
    const response = await fetch(meowUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VoiceHub-Notification-Service'
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('MeoW 通知发送成功:', result)
      return true
    } else {
      console.error('MeoW 通知发送失败:', response.status, response.statusText)
      return false
    }
  } catch (error) {
    console.error('发送 MeoW 通知时出错:', error)
    return false
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
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        meowNickname: true,
        notificationSettings: {
          select: {
            enabled: true
          }
        }
      }
    })
    
    // 检查用户是否绑定了 MeoW 账号
    if (!user?.meowNickname) {
      return false
    }
    
    // 检查用户是否启用了通知
    if (user.notificationSettings && !user.notificationSettings.enabled) {
      return false
    }
    
    // 检查是否有其他用户绑定了相同的 MeoW ID
    const usersWithSameMeowId = await db.user.findMany({
      where: {
        meowNickname: user.meowNickname,
        id: { not: userId }
      },
      select: {
        name: true
      }
    })
    
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
    return await sendMeowNotification(
      user.meowNickname,
      fullTitle,
      enhancedMessage,
      url
    )
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
  const users = await db.user.findMany({
    where: {
      id: { in: userIds },
      meowNickname: { not: null }
    },
    select: {
      id: true,
      name: true,
      meowNickname: true,
      notificationSettings: {
        select: {
          enabled: true
        }
      }
    }
  })
  
  // 获取站点标题
  const siteTitle = await getSiteTitle()
  const fullTitle = `${notificationTitle} | ${siteTitle}通知推送`
  
  // 统计每个 MeoW ID 绑定的用户数量
  const meowIdCounts = new Map<string, number>()
  users.forEach(user => {
    const count = meowIdCounts.get(user.meowNickname!) || 0
    meowIdCounts.set(user.meowNickname!, count + 1)
  })
  
  // 并发发送通知（限制并发数）
  const batchSize = 5
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize)
    
    const promises = batch.map(async (user) => {
      // 检查用户是否启用了通知
      if (user.notificationSettings && !user.notificationSettings.enabled) {
        return false
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
      
      return await sendMeowNotification(
        user.meowNickname!,
        fullTitle,
        enhancedMessage,
        url
      )
    })
    
    const results = await Promise.allSettled(promises)
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        success++
      } else {
        failed++
      }
    })
  }
  
  return { success, failed }
}