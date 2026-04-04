import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SYSTEM_SETTINGS_DEFAULTS } from '../../utils/system-settings-defaults'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能更新系统设置'
    })
  }

  try {
    const body = await readBody(event)

    // 验证请求体
    const updateData: any = {}

    if (body.hideStudentInfo !== undefined) {
      if (typeof body.hideStudentInfo !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'hideStudentInfo 必须是布尔值'
        })
      }
      updateData.hideStudentInfo = body.hideStudentInfo
    }

    if (body.enablePlayTimeSelection !== undefined) {
      if (typeof body.enablePlayTimeSelection !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enablePlayTimeSelection 必须是布尔值'
        })
      }
      updateData.enablePlayTimeSelection = body.enablePlayTimeSelection
    }

    if (body.siteTitle !== undefined) {
      updateData.siteTitle = body.siteTitle
    }

    if (body.siteLogoUrl !== undefined) {
      updateData.siteLogoUrl = body.siteLogoUrl
    }

    if (body.schoolLogoHomeUrl !== undefined) {
      updateData.schoolLogoHomeUrl = body.schoolLogoHomeUrl
    }

    if (body.schoolLogoPrintUrl !== undefined) {
      updateData.schoolLogoPrintUrl = body.schoolLogoPrintUrl
    }

    if (body.siteDescription !== undefined) {
      updateData.siteDescription = body.siteDescription
    }

    if (body.submissionGuidelines !== undefined) {
      updateData.submissionGuidelines = body.submissionGuidelines
    }

    if (body.icpNumber !== undefined) {
      updateData.icpNumber = body.icpNumber
    }

    if (body.gonganNumber !== undefined) {
      updateData.gonganNumber = body.gonganNumber
    }

    if (body.showBeianIcon !== undefined) {
      if (typeof body.showBeianIcon !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'showBeianIcon 必须是布尔值'
        })
      }
      updateData.showBeianIcon = body.showBeianIcon
    }

    if (body.enableSubmissionLimit !== undefined) {
      if (typeof body.enableSubmissionLimit !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enableSubmissionLimit 必须是布尔值'
        })
      }
      updateData.enableSubmissionLimit = body.enableSubmissionLimit
    }

    if (body.dailySubmissionLimit !== undefined) {
      if (
        body.dailySubmissionLimit !== null &&
        (!Number.isInteger(body.dailySubmissionLimit) || body.dailySubmissionLimit < 0)
      ) {
        throw createError({
          statusCode: 400,
          message: 'dailySubmissionLimit 必须是非负整数或null'
        })
      }
      updateData.dailySubmissionLimit = body.dailySubmissionLimit
    }

    if (body.weeklySubmissionLimit !== undefined) {
      if (
        body.weeklySubmissionLimit !== null &&
        (!Number.isInteger(body.weeklySubmissionLimit) || body.weeklySubmissionLimit < 0)
      ) {
        throw createError({
          statusCode: 400,
          message: 'weeklySubmissionLimit 必须是非负整数或null'
        })
      }
      updateData.weeklySubmissionLimit = body.weeklySubmissionLimit
    }

    if (body.monthlySubmissionLimit !== undefined) {
      if (
        body.monthlySubmissionLimit !== null &&
        (!Number.isInteger(body.monthlySubmissionLimit) || body.monthlySubmissionLimit < 0)
      ) {
        throw createError({
          statusCode: 400,
          message: 'monthlySubmissionLimit 必须是非负整数或null'
        })
      }
      updateData.monthlySubmissionLimit = body.monthlySubmissionLimit
    }

    if (body.showBlacklistKeywords !== undefined) {
      if (typeof body.showBlacklistKeywords !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'showBlacklistKeywords 必须是布尔值'
        })
      }
      updateData.showBlacklistKeywords = body.showBlacklistKeywords
    }

    if (body.enableReplayRequests !== undefined) {
      if (typeof body.enableReplayRequests !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enableReplayRequests 必须是布尔值'
        })
      }
      updateData.enableReplayRequests = body.enableReplayRequests
    }

    if (body.enableCollaborativeSubmission !== undefined) {
      if (typeof body.enableCollaborativeSubmission !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enableCollaborativeSubmission 必须是布尔值'
        })
      }
      updateData.enableCollaborativeSubmission = body.enableCollaborativeSubmission
    }

    if (body.enableSubmissionRemarks !== undefined) {
      if (typeof body.enableSubmissionRemarks !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enableSubmissionRemarks 必须是布尔值'
        })
      }
      updateData.enableSubmissionRemarks = body.enableSubmissionRemarks
    }

    if (body.enableRequestTimeLimitation !== undefined) {
      if (typeof body.enableRequestTimeLimitation !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enableRequestTimeLimitation 必须是布尔值'
        })
      }
      updateData.enableRequestTimeLimitation = body.enableRequestTimeLimitation
    }

    if (body.forceBlockAllRequests !== undefined) {
      if (typeof body.forceBlockAllRequests !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'forceBlockAllRequests 必须是布尔值'
        })
      }
      updateData.forceBlockAllRequests = body.forceBlockAllRequests
    }

    // SMTP配置字段
    if (body.smtpEnabled !== undefined) {
      if (typeof body.smtpEnabled !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'smtpEnabled 必须是布尔值'
        })
      }
      updateData.smtpEnabled = body.smtpEnabled
    }

    if (body.smtpHost !== undefined) {
      updateData.smtpHost = body.smtpHost
    }

    if (body.smtpPort !== undefined) {
      if (
        body.smtpPort !== null &&
        (!Number.isInteger(body.smtpPort) || body.smtpPort < 1 || body.smtpPort > 65535)
      ) {
        throw createError({
          statusCode: 400,
          message: 'smtpPort 必须是1-65535之间的整数'
        })
      }
      updateData.smtpPort = body.smtpPort
    }

    if (body.smtpSecure !== undefined) {
      if (typeof body.smtpSecure !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'smtpSecure 必须是布尔值'
        })
      }
      updateData.smtpSecure = body.smtpSecure
    }

    if (body.smtpUsername !== undefined) {
      updateData.smtpUsername = body.smtpUsername
    }

    if (body.smtpPassword !== undefined && body.smtpPassword !== '****************') {
      updateData.smtpPassword = body.smtpPassword
    }

    if (body.smtpFromEmail !== undefined) {
      updateData.smtpFromEmail = body.smtpFromEmail
    }

    if (body.smtpFromName !== undefined) {
      updateData.smtpFromName = body.smtpFromName
    }

    // 验证每日、每周和每月限额三选一逻辑
    const limitSettings = [
      body.dailySubmissionLimit,
      body.weeklySubmissionLimit,
      body.monthlySubmissionLimit
    ].filter((limit) => limit !== undefined && limit !== null)

    if (body.enableSubmissionLimit && limitSettings.length > 1) {
      throw createError({
        statusCode: 400,
        message: '每日限额、每周限额和每月限额只能选择其中一种，其他必须设置为空'
      })
    }

    // 获取当前设置，如果不存在则创建
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0]

    if (!settings) {
      const newSettingsResult = await db
        .insert(systemSettings)
        .values({ ...SYSTEM_SETTINGS_DEFAULTS, ...updateData })
        .returning()
      settings = newSettingsResult[0]
    } else {
      // 如果存在，更新设置
      const updatedSettingsResult = await db
        .update(systemSettings)
        .set(updateData)
        .where(eq(systemSettings.id, settings.id))
        .returning()
      settings = updatedSettingsResult[0]
    }

    // 清除系统设置缓存
    try {
      const { CacheService } = await import('~~/server/services/cacheService')
      await CacheService.getInstance().clearSystemSettingsCache()
      console.log('[Cache] 系统设置缓存已清除（更新系统设置）')
    } catch (cacheError) {
      console.warn('清除系统设置缓存失败:', cacheError)
    }

    try {
      const { SmtpService } = await import('~~/server/services/smtpService')
      await SmtpService.getInstance().initializeSmtpConfig()
      console.log('[SMTP] SMTP配置已重新加载（更新系统设置）')
    } catch (smtpError) {
      console.warn('[SMTP] SMTP配置重载失败:', smtpError)
    }

    return settings
  } catch (error) {
    console.error('更新系统设置失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '更新系统设置失败'
    })
  }
})
