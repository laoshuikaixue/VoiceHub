import { prisma } from '../models/schema'

/**
 * 创建歌曲被选中的通知
 */
export async function createSongSelectedNotification(songId: number) {
  try {
    // 获取歌曲信息
    const song = await prisma.song.findUnique({
      where: {
        id: songId
      }
    })
    
    if (!song) {
      console.error(`无法为ID为${songId}的歌曲创建通知：歌曲不存在`)
      return null
    }
    
    // 获取用户通知设置
    const settings = await prisma.notificationSettings.findUnique({
      where: {
        userId: song.requesterId
      }
    })
    
    // 如果用户关闭了此类通知，则不发送
    if (settings && !settings.enabled) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: song.requesterId,
        type: 'SONG_SELECTED',
        message: `您投稿的歌曲《${song.title}》已被选中安排播放。`,
        songId: songId
      }
    })
    
    return notification
  } catch (err) {
    console.error('创建歌曲被选中通知失败:', err)
    return null
  }
}

/**
 * 创建歌曲已播放的通知
 */
export async function createSongPlayedNotification(songId: number) {
  try {
    // 获取歌曲信息
    const song = await prisma.song.findUnique({
      where: {
        id: songId
      }
    })
    
    if (!song) {
      console.error(`无法为ID为${songId}的歌曲创建通知：歌曲不存在`)
      return null
    }
    
    // 获取用户通知设置
    const settings = await prisma.notificationSettings.findUnique({
      where: {
        userId: song.requesterId
      }
    })
    
    // 如果用户关闭了此类通知，则不发送
    if (settings && !settings.songPlayedEnabled) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: song.requesterId,
        type: 'SONG_PLAYED',
        message: `您投稿的歌曲《${song.title}》已播放。`,
        songId: songId
      }
    })
    
    return notification
  } catch (err) {
    console.error('创建歌曲已播放通知失败:', err)
    return null
  }
}

/**
 * 创建歌曲获得投票的通知
 */
export async function createSongVotedNotification(songId: number, voterId: number) {
  try {
    // 获取歌曲信息
    const song = await prisma.song.findUnique({
      where: {
        id: songId
      },
      include: {
        votes: true
      }
    })
    
    if (!song) {
      console.error(`无法为ID为${songId}的歌曲创建通知：歌曲不存在`)
      return null
    }
    
    // 获取投票用户信息
    const voter = await prisma.user.findUnique({
      where: {
        id: voterId
      }
    })
    
    if (!voter) {
      console.error(`无法为ID为${voterId}的用户创建通知：用户不存在`)
      return null
    }
    
    // 获取用户通知设置
    const settings = await prisma.notificationSettings.findUnique({
      where: {
        userId: song.requesterId
      }
    })
    
    // 如果用户关闭了此类通知，则不发送
    if (settings && !settings.songVotedEnabled) {
      return null
    }
    
    // 不要给自己投票发通知
    if (song.requesterId === voterId) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: song.requesterId,
        type: 'SONG_VOTED',
        message: `您投稿的歌曲《${song.title}》获得了一个新的投票，当前共有 ${song.votes.length} 个投票。`,
        songId: songId
      }
    })
    
    return notification
  } catch (err) {
    console.error('创建歌曲获得投票通知失败:', err)
    return null
  }
}

/**
 * 创建系统通知
 */
export async function createSystemNotification(userId: number, title: string, content: string) {
  try {
    // 获取用户通知设置
    const settings = await prisma.notificationSettings.findUnique({
      where: {
        userId: userId
      }
    })
    
    // 如果用户关闭了通知，则不发送
    if (settings && !settings.enabled) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        type: 'SYSTEM_NOTICE',
        message: content
      }
    })
    
    return notification
  } catch (err) {
    console.error('创建系统通知失败:', err)
    return null
  }
} 

/**
 * 批量创建系统通知
 */
export async function createBatchSystemNotifications(
  userIds: number[],
  title: string,
  content: string
) {
  try {
    if (!userIds.length) {
      console.warn('没有可发送通知的用户')
      return []
    }
    
    // 获取用户通知设置
    const userSettings = await prisma.notificationSettings.findMany({
      where: {
        userId: { in: userIds }
      }
    })
    
    // 构建用户ID到通知设置的映射
    const settingsMap = new Map()
    userSettings.forEach(setting => {
      settingsMap.set(setting.userId, setting)
    })
    
    // 准备要创建的通知数据
    const notificationsToCreate = []
    
    for (const userId of userIds) {
      const settings = settingsMap.get(userId)
      
      // 如果用户关闭了通知，则不发送
      if (settings && !settings.enabled) {
        continue
      }
      
      notificationsToCreate.push({
        userId,
        type: 'SYSTEM_NOTICE',
        message: content
      })
    }
    
    // 如果没有可发送的通知，直接返回
    if (notificationsToCreate.length === 0) {
      return []
    }
    
    // 批量创建通知
    const notifications = await prisma.notification.createMany({
      data: notificationsToCreate
    })
    
    return {
      count: notifications.count,
      total: userIds.length
    }
  } catch (err) {
    console.error('批量创建系统通知失败:', err)
    return null
  }
} 