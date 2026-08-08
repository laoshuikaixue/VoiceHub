import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  apiKeyPermissions,
  apiKeys,
  apiLogs,
  cardCodeRedeemLogs,
  cardCodes,
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
import { assertAdminOperationTablesProtected, getAdminOperationFailureCode, recordAdminOperation, shouldRecordAdminOperationFailure } from '~~/server/services/adminOperationLogService'

// 此列表必须与下方实际删除的业务表同步；admin_operation_logs 为只追加审计表。
const BACKUP_CLEAR_TARGET_TABLES = ['api_logs', 'api_key_permissions', 'api_keys', 'notifications', 'notification_settings', 'card_code_redeem_logs', 'collaboration_logs', 'song_collaborators', 'song_replay_requests', 'schedules', 'votes', 'user_status_logs', 'email_templates', 'song_blacklists', 'user_identities', 'songs', 'card_codes', 'play_times', 'semesters', 'request_times', 'system_settings', 'users']

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    if (user) {
      await recordAdminOperation(event, { actor: { id: user.id, role: user.role }, action: 'DB.RESET', targetType: 'DATABASE', targetId: 'clear', result: 'FAILURE', summary: '管理员清空数据库被拒绝', failureCode: 'HTTP_403' })
    }
    throw createError({
      statusCode: 403,
      message: '只有超级管理员可以清空数据库'
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
      await db.delete(cardCodeRedeemLogs).where(eq(cardCodeRedeemLogs.redeemedBy, currentUserId))
      await db.delete(userStatusLogs).where(eq(userStatusLogs.userId, currentUserId))
      await db.delete(userIdentities).where(eq(userIdentities.userId, currentUserId))
      await db.delete(users).where(eq(users.id, currentUserId))

      await recordAdminOperation(event, {
        actor: { id: user.id, role: user.role },
        action: 'DB.RESET',
        targetType: 'DATABASE',
        targetId: 'temporary-admin',
        result: 'SUCCESS',
        summary: '管理员清理了临时管理员数据'
      })

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
    assertAdminOperationTablesProtected(BACKUP_CLEAR_TARGET_TABLES)

    if (shouldOverwriteSuperAdmin || preservedSuperAdminIds.length === 0) {
      await db.delete(apiLogs)
      await db.delete(apiKeyPermissions)
      await db.delete(apiKeys)
      await db.delete(notifications)
      await db.delete(notificationSettings)
      await db.delete(cardCodeRedeemLogs)
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
      await db.delete(cardCodes)
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
      await db.delete(cardCodeRedeemLogs)
      await db.delete(collaborationLogs)
      await db.delete(songCollaborators)
      await db.delete(songReplayRequests)
      await db.delete(schedules)
      await db.delete(votes)
      await db
        .delete(userStatusLogs)
        .where(notInArray(userStatusLogs.userId, preservedSuperAdminIds))
      await db.delete(emailTemplates)
      await db.delete(songBlacklists)
      await db
        .delete(userIdentities)
        .where(notInArray(userIdentities.userId, preservedSuperAdminIds))
      await db.delete(songs)
      await db.delete(cardCodes)
      await db.delete(playTimes)
      await db.delete(semesters)
      await db.delete(requestTimes)
      await db.delete(systemSettings)
      await db.delete(users).where(notInArray(users.id, preservedSuperAdminIds))
    }

    console.log('✅ 现有数据已清空')
    await recordAdminOperation(event, {
      actor: { id: user.id, role: user.role },
      action: 'DB.RESET',
      targetType: 'DATABASE',
      targetId: 'clear',
      result: 'SUCCESS',
      summary: '管理员清空了数据库',
      changes: { mode: shouldOverwriteSuperAdmin ? 'overwrite-super-admin' : 'preserve-super-admin' }
    })
    return {
      success: true,
      message: '数据已清空',
      shouldOverwriteSuperAdmin,
      preservedSuperAdminIds,
      temporaryPreservedUserId
    }
  } catch (error) {
    console.error('清空数据失败:', error)
    if (shouldRecordAdminOperationFailure(error)) {
      await recordAdminOperation(event, {
        actor: event.context.user,
        action: 'DB.RESET',
        targetType: 'DATABASE',
        targetId: 'clear',
        result: 'FAILURE',
        summary: '管理员清空数据库失败',
        failureCode: getAdminOperationFailureCode(error, 'DB_CLEAR_FAILED')
      })
    }
    throw createError({
      statusCode: 500,
      message: '清空数据失败：' + error.message
    })
  }
})
