import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import {
  notifications,
  notificationSettings,
  playTimes,
  schedules,
  semesters,
  songBlacklists,
  songs,
  systemSettings,
  users,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { and, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '权限不足'
    })
  }

  // 只有超级管理员可以清空数据库
  if (user.role !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: '只有超级管理员可以清空数据库'
    })
  }

  try {
    console.log('清空现有数据...')
    // 按照外键依赖顺序删除数据

    // 1. 删除关联表
    await db.delete(notifications)
    await db.delete(notificationSettings)
    await db.delete(schedules)
    await db.delete(votes)
    await db.delete(userStatusLogs)
    await db.delete(songBlacklists)

    // 2. 删除主业务表
    await db.delete(songs)

    // 3. 删除字典/配置表
    await db.delete(playTimes)
    await db.delete(semesters)
    await db.delete(systemSettings)

    // 4. 删除用户 (保留超级管理员和 ID 为 1 的用户)
    await db.delete(users).where(and(ne(users.role, 'SUPER_ADMIN'), ne(users.id, 1)))

    console.log('✅ 现有数据已清空')
    return { success: true, message: '数据已清空' }
  } catch (error) {
    console.error('清空数据失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '清空数据失败: ' + error.message
    })
  }
})
