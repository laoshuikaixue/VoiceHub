import { prisma } from '../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查用户认证
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能更新通知设置'
    })
  }
  
  const body = await readBody(event)
  
  // 验证请求体
  if (typeof body !== 'object' || body === null) {
    throw createError({
      statusCode: 400,
      message: '无效的请求数据'
    })
  }
  
  try {
    // 获取用户当前的通知设置
    let settings = await prisma.notificationSettings.findUnique({
      where: {
        userId: user.id
      }
    })
    
    if (settings) {
      // 更新现有设置
      settings = await prisma.notificationSettings.update({
        where: {
          userId: user.id
        },
        data: {
          songSelectedNotify: body.songSelectedNotify !== undefined ? body.songSelectedNotify : settings.songSelectedNotify,
          songPlayedNotify: body.songPlayedNotify !== undefined ? body.songPlayedNotify : settings.songPlayedNotify,
          songVotedNotify: body.songVotedNotify !== undefined ? body.songVotedNotify : settings.songVotedNotify,
          systemNotify: body.systemNotify !== undefined ? body.systemNotify : settings.systemNotify
        }
      })
    } else {
      // 创建新设置
      settings = await prisma.notificationSettings.create({
        data: {
          userId: user.id,
          songSelectedNotify: body.songSelectedNotify !== undefined ? body.songSelectedNotify : true,
          songPlayedNotify: body.songPlayedNotify !== undefined ? body.songPlayedNotify : true,
          songVotedNotify: body.songVotedNotify !== undefined ? body.songVotedNotify : true,
          systemNotify: body.systemNotify !== undefined ? body.systemNotify : true
        }
      })
    }
    
    return settings
  } catch (err) {
    console.error('更新通知设置失败:', err)
    throw createError({
      statusCode: 500,
      message: '更新通知设置失败'
    })
  }
}) 