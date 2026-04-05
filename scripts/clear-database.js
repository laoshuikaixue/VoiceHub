/**
 * 数据库清空脚本
 * 这个脚本会清空所有表的数据，但保留表结构
 */
import { sql } from 'drizzle-orm'
import {
  apiKeyPermissions,
  apiKeys,
  apiLogs,
  db,
  emailTemplates,
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
} from '../app/drizzle/db.ts'
import bcrypt from 'bcrypt'

// 重置所有表的自增序列
async function resetAutoIncrementSequences() {
  const tables = [
    'User',
    'Song',
    'Vote',
    'Schedule',
    'Notification',
    'NotificationSettings',
    'PlayTime',
    'Semester',
    'SystemSettings',
    'SongBlacklist',
    'EmailTemplate',
    'user_status_logs'
  ]

  console.log('重置自增序列...')

  for (const table of tables) {
    try {
      // 获取表的最大ID
      const maxIdResult = await db.execute(sql.raw(`SELECT MAX(id) as max_id FROM "${table}"`))
      const maxId = Number(maxIdResult.rows?.[0]?.max_id || maxIdResult[0]?.max_id || 0)

      // PostgreSQL 获取序列名称并重置
      const sequenceNameResult = await db.execute(
        sql.raw(`SELECT pg_get_serial_sequence('"${table}"', 'id') as sequence_name`)
      )
      const sequenceName =
        sequenceNameResult.rows?.[0]?.sequence_name || sequenceNameResult[0]?.sequence_name

      if (sequenceName) {
        if (maxId === 0) {
          await db.execute(sql.raw(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`))
        } else {
          const newSequenceValue = maxId
          await db.execute(sql.raw(`SELECT setval('${sequenceName}', ${newSequenceValue})`))
        }
      } else {
        console.warn(`未找到表 ${table} 的序列`)
      }
    } catch (error) {
      console.warn(`重置 ${table} 表序列失败: ${error.message}`)
    }
  }
}

async function main() {
  console.log('开始清空数据库...')

  // 清空所有表数据
  try {
    // 按照关联关系顺序删除数据
    await db.delete(notifications)
    await db.delete(notificationSettings)
    await db.delete(schedules)
    await db.delete(votes)
    await db.delete(songs)
    await db.delete(playTimes)
    await db.delete(semesters)
    await db.delete(systemSettings)
    await db.delete(songBlacklists)
    await db.delete(apiLogs)
    await db.delete(apiKeyPermissions)
    await db.delete(apiKeys)
    await db.delete(userStatusLogs)
    await db.delete(emailTemplates)
    await db.delete(users)

    console.log('数据库已清空，开始重置自增序列...')

    // 先重置所有自增序列
    await resetAutoIncrementSequences()

    console.log('开始创建默认超级管理员账户...')

    // 创建默认管理员账户
    const hashedPassword = await bcrypt.hash('admin123', 10)

    // 创建超级管理员用户
    const [admin] = await db
      .insert(users)
      .values({
        name: '超级管理员',
        username: 'admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        forcePasswordChange: false
      })
      .returning()

    console.log('默认超级管理员账户已创建:')
    console.log('账号名: admin')
    console.log('密码: admin123')
    console.log(`管理员ID: ${admin.id}`)

    // 调整User表的自增序列，确保下一个用户从admin.id + 1开始
    try {
      const sequenceNameResult = await db.execute(
        sql.raw(`SELECT pg_get_serial_sequence('"User"', 'id') as sequence_name`)
      )
      const sequenceName =
        sequenceNameResult.rows?.[0]?.sequence_name || sequenceNameResult[0]?.sequence_name

      if (sequenceName) {
        const nextId = admin.id
        await db.execute(sql.raw(`SELECT setval('${sequenceName}', ${nextId})`))
      }
    } catch (error) {
      console.warn(`调整User表序列失败: ${error.message}`)
    }

    console.log('🎉 数据库清空、初始化和序列重置全部完成!')
  } catch (error) {
    console.error('清空数据库时出错:', error)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
