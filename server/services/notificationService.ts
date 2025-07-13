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
    if (settings && !settings.songSelectedNotify) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: song.requesterId,
        type: 'SONG_SELECTED',
        title: '歌曲已被选中',
        content: `您投稿的歌曲《${song.title}》已被选中安排播放。`,
        relatedId: songId
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
    if (settings && !settings.songPlayedNotify) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: song.requesterId,
        type: 'SONG_PLAYED',
        title: '歌曲已播放',
        content: `您投稿的歌曲《${song.title}》已播放。`,
        relatedId: songId
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
    if (settings && !settings.songVotedNotify) {
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
        title: '歌曲获得新投票',
        content: `您投稿的歌曲《${song.title}》获得了一个新的投票，当前共有 ${song.votes.length} 个投票。`,
        relatedId: songId
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
    
    // 如果用户关闭了此类通知，则不发送
    if (settings && !settings.systemNotify) {
      return null
    }
    
    // 创建通知
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        type: 'SYSTEM_NOTICE',
        title: title,
        content: content
      }
    })
    
    return notification
  } catch (err) {
    console.error('创建系统通知失败:', err)
    return null
  }
} 