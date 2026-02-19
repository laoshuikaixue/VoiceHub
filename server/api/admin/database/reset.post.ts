import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { CacheService } from '../../../services/cacheService'
import {
  apiKeyPermissions,
  apiKeys,
  apiLogs,
  collaborationLogs,
  emailTemplates,
  notificationSettings,
  notifications,
  playTimes,
  requestTimes,
  schedules,
  semesters,
  songBlacklists,
  songCollaborators,
  songReplayRequests,
  songs,
  systemSettings,
  userIdentities,
  users,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { ne, sql } from 'drizzle-orm'

// 重置所有表的自增序列
async function resetAutoIncrementSequences() {
  const tables = [
    { name: 'users', dbName: 'User' },
    { name: 'songs', dbName: 'Song' },
    { name: 'votes', dbName: 'Vote' },
    { name: 'schedules', dbName: 'Schedule' },
    { name: 'notifications', dbName: 'Notification' },
    { name: 'notificationSettings', dbName: 'NotificationSettings' },
    { name: 'playTimes', dbName: 'PlayTime' },
    { name: 'semesters', dbName: 'Semester' },
    { name: 'systemSettings', dbName: 'SystemSettings' },
    { name: 'songBlacklists', dbName: 'SongBlacklist' },
    { name: 'userStatusLogs', dbName: 'user_status_logs' },
    { name: 'userIdentities', dbName: 'UserIdentity' },
    { name: 'requestTimes', dbName: 'RequestTime' },
    { name: 'songReplayRequests', dbName: 'song_replay_requests' },
    { name: 'emailTemplates', dbName: 'EmailTemplate' }
  ]

  const results = []

  for (const table of tables) {
    try {
      // 获取序列名称
      const sequenceNameResult = await db.execute(
        sql.raw(`SELECT pg_get_serial_sequence('"${table.dbName}"', 'id') as sequence_name`)
      )
      const sequenceName = (sequenceNameResult as any)[0]?.sequence_name

      if (sequenceName) {
        // 重置序列值到 1
        await db.execute(sql.raw(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`))
        results.push({ table: table.name, success: true })
      } else {
        results.push({ table: table.name, success: false, message: 'Sequence not found' })
      }
    } catch (error) {
      console.warn(`重置 ${table.name} 表序列失败: ${error.message}`)
      results.push({ table: table.name, success: false, error: error.message })
    }
  }
  return results
}

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    const resetResults = {
      success: true,
      message: '数据库重置完成',
      details: {
        tablesCleared: 0,
        recordsDeleted: 0,
        sequencesReset: 0,
        errors: [],
        preservedData: []
      }
    }

    try {
      // 使用事务确保数据一致性
      await db.transaction(async (tx) => {
        // 按照外键依赖顺序删除数据

        // 1. API 日志与权限 (依赖于 API 密钥)
        const deletedApiLogs = await tx.delete(apiLogs).returning({ id: apiLogs.id })
        resetResults.details.recordsDeleted += deletedApiLogs.length
        resetResults.details.tablesCleared++

        const deletedApiKeyPermissions = await tx
          .delete(apiKeyPermissions)
          .returning({ id: apiKeyPermissions.id })
        resetResults.details.recordsDeleted += deletedApiKeyPermissions.length
        resetResults.details.tablesCleared++

        // 2. API 密钥 (依赖于用户)
        const deletedApiKeys = await tx.delete(apiKeys).returning({ id: apiKeys.id })
        resetResults.details.recordsDeleted += deletedApiKeys.length
        resetResults.details.tablesCleared++

        // 3. 通知与设置 (依赖于用户、歌曲)
        const deletedNotifications = await tx
          .delete(notifications)
          .returning({ id: notifications.id })
        resetResults.details.recordsDeleted += deletedNotifications.length
        resetResults.details.tablesCleared++

        const deletedNotificationSettings = await tx
          .delete(notificationSettings)
          .returning({ id: notificationSettings.id })
        resetResults.details.recordsDeleted += deletedNotificationSettings.length
        resetResults.details.tablesCleared++

        // 4. 协作日志 (依赖于歌曲协作者)
        const deletedCollaborationLogs = await tx
          .delete(collaborationLogs)
          .returning({ id: collaborationLogs.id })
        resetResults.details.recordsDeleted += deletedCollaborationLogs.length
        resetResults.details.tablesCleared++

        // 5. 歌曲协作者 (依赖于歌曲、用户)
        const deletedSongCollaborators = await tx
          .delete(songCollaborators)
          .returning({ id: songCollaborators.id })
        resetResults.details.recordsDeleted += deletedSongCollaborators.length
        resetResults.details.tablesCleared++

        // 6. 歌曲重播申请 (依赖于歌曲、用户)
        const deletedReplayRequests = await tx
          .delete(songReplayRequests)
          .returning({ id: songReplayRequests.id })
        resetResults.details.recordsDeleted += deletedReplayRequests.length
        resetResults.details.tablesCleared++

        // 7. 排期 (依赖于歌曲、播出时段)
        const deletedSchedules = await tx.delete(schedules).returning({ id: schedules.id })
        resetResults.details.recordsDeleted += deletedSchedules.length
        resetResults.details.tablesCleared++

        // 8. 投票 (依赖于歌曲、用户)
        const deletedVotes = await tx.delete(votes).returning({ id: votes.id })
        resetResults.details.recordsDeleted += deletedVotes.length
        resetResults.details.tablesCleared++

        // 9. 歌曲 (依赖于用户、播出时段)
        const deletedSongs = await tx.delete(songs).returning({ id: songs.id })
        resetResults.details.recordsDeleted += deletedSongs.length
        resetResults.details.tablesCleared++

        // 10. 黑名单 (依赖于用户 [创建者])
        const deletedBlacklists = await tx
          .delete(songBlacklists)
          .returning({ id: songBlacklists.id })
        resetResults.details.recordsDeleted += deletedBlacklists.length
        resetResults.details.tablesCleared++

        // 11. 用户状态日志 (依赖于用户)
        const deletedStatusLogs = await tx
          .delete(userStatusLogs)
          .returning({ id: userStatusLogs.id })
        resetResults.details.recordsDeleted += deletedStatusLogs.length
        resetResults.details.tablesCleared++

        // 12. 第三方身份关联 (依赖于用户)
        const deletedUserIdentities = await tx
          .delete(userIdentities)
          .returning({ id: userIdentities.id })
        resetResults.details.recordsDeleted += deletedUserIdentities.length
        resetResults.details.tablesCleared++

        // 13. 邮件模板 (依赖于用户 [更新者])
        const deletedEmailTemplates = await tx
          .delete(emailTemplates)
          .returning({ id: emailTemplates.id })
        resetResults.details.recordsDeleted += deletedEmailTemplates.length
        resetResults.details.tablesCleared++

        // 14. 用户 (除自己外)
        const deletedUsers = await tx
          .delete(users)
          .where(ne(users.id, user.id))
          .returning({ id: users.id })
        resetResults.details.recordsDeleted += deletedUsers.length
        resetResults.details.tablesCleared++
        resetResults.details.preservedData.push(`保留当前管理员账户: ${user.name}`)

        // 15. 播出时段
        const deletedPlayTimes = await tx.delete(playTimes).returning({ id: playTimes.id })
        resetResults.details.recordsDeleted += deletedPlayTimes.length
        resetResults.details.tablesCleared++

        // 16. 学期
        const deletedSemesters = await tx.delete(semesters).returning({ id: semesters.id })
        resetResults.details.recordsDeleted += deletedSemesters.length
        resetResults.details.tablesCleared++

        // 17. 请求时段
        const deletedRequestTimes = await tx.delete(requestTimes).returning({ id: requestTimes.id })
        resetResults.details.recordsDeleted += deletedRequestTimes.length
        resetResults.details.tablesCleared++

        // 18. 系统设置
        const deletedSystemSettings = await tx
          .delete(systemSettings)
          .returning({ id: systemSettings.id })
        resetResults.details.recordsDeleted += deletedSystemSettings.length
        resetResults.details.tablesCleared++
      })

      // 重置自增序列
      const sequenceResults = await resetAutoIncrementSequences()
      resetResults.details.sequencesReset = sequenceResults.filter((r) => r.success).length

      // 清除缓存
      try {
        const cacheService = CacheService.getInstance()
        await cacheService.clearAllCache()
      } catch (error) {
        console.warn('清除缓存失败:', error)
        resetResults.details.warnings = resetResults.details.warnings || []
        resetResults.details.warnings.push('清除缓存失败')
      }
    } catch (error) {
      console.error('重置数据库失败:', error)
      throw createError({
        statusCode: 500,
        statusMessage: `重置数据库失败: ${error.message}`
      })
    }

    return resetResults
  } catch (error) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '服务器内部错误'
    })
  }
})
