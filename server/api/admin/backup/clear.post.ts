import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  apiKeyPermissions,
  apiKeys,
  apiLogs,
  collaborationLogs,
  emailTemplates,
  notifications,
  notificationSettings,
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
import { eq, inArray, isNull, notInArray, or } from 'drizzle-orm'

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
    const body = await readBody(event)
    const finalizeTempUser = body?.finalizeTempUser === true
    const overwriteSuperAdmin = body?.overwriteSuperAdmin === true
    const hasSuperAdminInBackup = body?.hasSuperAdminInBackup === true
    const shouldOverwriteSuperAdmin = overwriteSuperAdmin && hasSuperAdminInBackup

    if (finalizeTempUser) {
      const currentUserId = Number(user.id)
      const currentUserApiKeys = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.createdByUserId, currentUserId))
      const currentUserApiKeyIds = currentUserApiKeys.map((item) => item.id)

      if (currentUserApiKeyIds.length > 0) {
        await db.delete(apiLogs).where(inArray(apiLogs.apiKeyId, currentUserApiKeyIds))
        await db
          .delete(apiKeyPermissions)
          .where(inArray(apiKeyPermissions.apiKeyId, currentUserApiKeyIds))
      }

      await db.delete(apiKeys).where(eq(apiKeys.createdByUserId, currentUserId))
      await db.delete(notifications).where(eq(notifications.userId, currentUserId))
      await db.delete(notificationSettings).where(eq(notificationSettings.userId, currentUserId))
      await db.delete(userStatusLogs).where(eq(userStatusLogs.userId, currentUserId))
      await db.delete(userIdentities).where(eq(userIdentities.userId, currentUserId))
      await db.delete(users).where(eq(users.id, currentUserId))

      return {
        success: true,
        message: '临时管理员账户已清理',
        finalized: true
      }
    }

    let preservedSuperAdminIds: number[] = []
    let temporaryPreservedUserId: number | null = null
    if (!shouldOverwriteSuperAdmin) {
      const preservedUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, 'SUPER_ADMIN'), eq(users.id, 1)))
      preservedSuperAdminIds = preservedUsers.map((item) => item.id)
    } else {
      temporaryPreservedUserId = Number(user.id)
    }

    console.log('清空现有数据...')

    if (shouldOverwriteSuperAdmin || preservedSuperAdminIds.length === 0) {
      await db.delete(apiLogs)
      await db.delete(apiKeyPermissions)
      await db.delete(apiKeys)
      await db.delete(notifications)
      await db.delete(notificationSettings)
      await db.delete(collaborationLogs)
      await db.delete(songCollaborators)
      await db.delete(songReplayRequests)
      await db.delete(schedules)
      await db.delete(votes)
      await db.delete(userStatusLogs)
      await db.delete(emailTemplates)
      await db.delete(songBlacklists)
      await db.delete(userIdentities)
      await db.delete(songs)
      await db.delete(playTimes)
      await db.delete(semesters)
      await db.delete(requestTimes)
      await db.delete(systemSettings)
      if (temporaryPreservedUserId) {
        await db.delete(users).where(notInArray(users.id, [temporaryPreservedUserId]))
      } else {
        await db.delete(users)
      }
    } else {
      const preservedApiKeys = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(inArray(apiKeys.createdByUserId, preservedSuperAdminIds))
      const preservedApiKeyIds = preservedApiKeys.map((item) => item.id)

      if (preservedApiKeyIds.length > 0) {
        await db
          .delete(apiLogs)
          .where(or(isNull(apiLogs.apiKeyId), notInArray(apiLogs.apiKeyId, preservedApiKeyIds)))
        await db
          .delete(apiKeyPermissions)
          .where(notInArray(apiKeyPermissions.apiKeyId, preservedApiKeyIds))
      } else {
        await db.delete(apiLogs)
        await db.delete(apiKeyPermissions)
      }
      await db.delete(apiKeys).where(notInArray(apiKeys.createdByUserId, preservedSuperAdminIds))
      await db.delete(notifications).where(notInArray(notifications.userId, preservedSuperAdminIds))
      await db
        .delete(notificationSettings)
        .where(notInArray(notificationSettings.userId, preservedSuperAdminIds))
      await db.delete(collaborationLogs)
      await db.delete(songCollaborators)
      await db.delete(songReplayRequests)
      await db.delete(schedules)
      await db.delete(votes)
      await db.delete(userStatusLogs).where(notInArray(userStatusLogs.userId, preservedSuperAdminIds))
      await db.delete(emailTemplates)
      await db.delete(songBlacklists)
      await db.delete(userIdentities).where(notInArray(userIdentities.userId, preservedSuperAdminIds))
      await db.delete(songs)
      await db.delete(playTimes)
      await db.delete(semesters)
      await db.delete(requestTimes)
      await db.delete(systemSettings)
      await db.delete(users).where(notInArray(users.id, preservedSuperAdminIds))
    }

    console.log('✅ 现有数据已清空')
    return {
      success: true,
      message: '数据已清空',
      shouldOverwriteSuperAdmin,
      preservedSuperAdminIds,
      temporaryPreservedUserId
    }
  } catch (error) {
    console.error('清空数据失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '清空数据失败: ' + error.message
    })
  }
})
