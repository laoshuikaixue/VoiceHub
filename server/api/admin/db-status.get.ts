import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { count, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const status = {
      connected: false,
      tables: {
        user: false,
        song: false,
        vote: false,
        schedule: false,
        notification: false
      },
      userCount: 0
    }

    // 检查数据库连接
    try {
      await db.execute(sql`SELECT 1`)
      status.connected = true
    } catch (error) {
      console.error('数据库连接失败:', error)
      return { success: false, status, error: '数据库连接失败' }
    }

    // 检查各个表是否存在
    const tables = ['user', 'song', 'vote', 'schedule', 'notification']

    for (const tableName of tables) {
      try {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )
        `)
        status.tables[tableName] = result[0]?.exists || false
      } catch (error) {
        console.error(`检查表 ${tableName} 失败:`, error)
        status.tables[tableName] = false
      }
    }

    // 如果表存在，获取记录数
    if (status.tables.user) {
      try {
        const userCountResult = await db.select({ count: count() }).from(users)
        status.userCount = userCountResult[0]?.count || 0
      } catch (error) {
        console.error('获取用户数量失败:', error)
      }
    }

    return {
      success: true,
      status
    }
  } catch (error) {
    console.error('检查数据库状态失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '检查数据库状态失败: ' + error.message
    })
  }
})
