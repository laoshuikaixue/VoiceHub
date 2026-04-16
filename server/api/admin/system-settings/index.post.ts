import { db } from '~/drizzle/db'
import { systemSettings } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { SMTP_PASSWORD_MASK, SECRET_FIELD_MASK, maskSystemSettingsSecrets } from './secretMask'
import { SYSTEM_SETTINGS_DEFAULTS } from '../../../utils/system-settings-defaults'

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

    if (body.enableVoucherPayment !== undefined) {
      if (typeof body.enableVoucherPayment !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'enableVoucherPayment 必须是布尔值'
        })
      }
      updateData.enableVoucherPayment = body.enableVoucherPayment
    }

    if (body.voucherRedeemDeadlineMinutes !== undefined) {
      if (!Number.isInteger(body.voucherRedeemDeadlineMinutes) || body.voucherRedeemDeadlineMinutes <= 0) {
        throw createError({
          statusCode: 400,
          message: 'voucherRedeemDeadlineMinutes 必须是正整数'
        })
      }
      updateData.voucherRedeemDeadlineMinutes = body.voucherRedeemDeadlineMinutes
    }

    if (body.voucherRemindWindowMinutes !== undefined) {
      if (!Number.isInteger(body.voucherRemindWindowMinutes) || body.voucherRemindWindowMinutes <= 0) {
        throw createError({
          statusCode: 400,
          message: 'voucherRemindWindowMinutes 必须是正整数'
        })
      }
      updateData.voucherRemindWindowMinutes = body.voucherRemindWindowMinutes
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

    if (body.smtpPassword !== undefined && body.smtpPassword !== SMTP_PASSWORD_MASK) {
      updateData.smtpPassword = body.smtpPassword
    }

    if (body.smtpFromEmail !== undefined) {
      updateData.smtpFromEmail = body.smtpFromEmail
    }

    if (body.smtpFromName !== undefined) {
      updateData.smtpFromName = body.smtpFromName
    }

    // 获取当前设置，用于验证更新后的 OAuth 组合配置
    const settingsResult = await db.select().from(systemSettings).limit(1)
    let settings = settingsResult[0]

    // OAuth 配置字段
    if (body.allowOAuthRegistration !== undefined) {
      if (typeof body.allowOAuthRegistration !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'allowOAuthRegistration 必须是布尔值'
        })
      }
      updateData.allowOAuthRegistration = body.allowOAuthRegistration
    }

    if (body.oauthRedirectUri !== undefined) {
      const normalizedOauthRedirectUri =
        typeof body.oauthRedirectUri === 'string' ? body.oauthRedirectUri.trim() : body.oauthRedirectUri

      if (normalizedOauthRedirectUri !== null && normalizedOauthRedirectUri !== '') {
        try {
          const uri = new URL(normalizedOauthRedirectUri)
          // 支持 broker 回调 (包含 /callback 或 /api/auth/[provider]/callback 结构)
          const validPathPattern = /(?:\/api)?\/auth\/[^/]+\/callback\/?$|\/callback\/?$/
          if (!validPathPattern.test(uri.pathname)) {
            throw createError({
              statusCode: 400,
              message: 'oauthRedirectUri 必须是回调地址，例如 https://yourdomain.com/api/auth/[provider]/callback'
            })
          }
        } catch (error: any) {
          if (error?.statusCode === 400) throw error
          throw createError({
            statusCode: 400,
            message: 'oauthRedirectUri 不是合法URL，示例：https://yourdomain.com/api/auth/[provider]/callback'
          })
        }
      }
      updateData.oauthRedirectUri = normalizedOauthRedirectUri === '' ? null : normalizedOauthRedirectUri
    }

    if (body.oauthStateSecret !== undefined && body.oauthStateSecret !== SECRET_FIELD_MASK) {
      updateData.oauthStateSecret = body.oauthStateSecret
    }

    const nextOauthRedirectUri =
      body.oauthRedirectUri !== undefined ? updateData.oauthRedirectUri : settings?.oauthRedirectUri
    const nextOauthStateSecret =
      body.oauthStateSecret !== undefined && body.oauthStateSecret !== SECRET_FIELD_MASK
        ? body.oauthStateSecret
        : settings?.oauthStateSecret
    const nextGithubOAuthEnabled =
      body.githubOAuthEnabled !== undefined ? body.githubOAuthEnabled : settings?.githubOAuthEnabled ?? false
    const nextCasdoorOAuthEnabled =
      body.casdoorOAuthEnabled !== undefined
        ? body.casdoorOAuthEnabled
        : settings?.casdoorOAuthEnabled ?? false
    const nextGoogleOAuthEnabled =
      body.googleOAuthEnabled !== undefined ? body.googleOAuthEnabled : settings?.googleOAuthEnabled ?? false
    const nextCustomOAuthEnabled =
      body.customOAuthEnabled !== undefined ? body.customOAuthEnabled : settings?.customOAuthEnabled ?? false

    if (
      nextGithubOAuthEnabled ||
      nextCasdoorOAuthEnabled ||
      nextGoogleOAuthEnabled ||
      nextCustomOAuthEnabled
    ) {
      if (!nextOauthRedirectUri || !nextOauthStateSecret) {
        throw createError({
          statusCode: 400,
          message: '启用 OAuth 登录方式前，请先在管理员后台配置 OAuth 重定向 URI 和 OAuth State 密钥'
        })
      }
    }

    // GitHub OAuth
    if (body.githubOAuthEnabled !== undefined) {
      if (typeof body.githubOAuthEnabled !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'githubOAuthEnabled 必须是布尔值'
        })
      }
      if (body.githubOAuthEnabled && (!body.githubClientId && !settings?.githubClientId)) {
        throw createError({ statusCode: 400, message: '启用 GitHub 登录时必须提供 Client ID' })
      }
      if (body.githubOAuthEnabled && (!body.githubClientSecret && !settings?.githubClientSecret)) {
        throw createError({ statusCode: 400, message: '启用 GitHub 登录时必须提供 Client Secret' })
      }
      updateData.githubOAuthEnabled = body.githubOAuthEnabled
    }

    if (body.githubClientId !== undefined) {
      updateData.githubClientId = body.githubClientId
    }

    if (body.githubClientSecret !== undefined && body.githubClientSecret !== SECRET_FIELD_MASK) {
      updateData.githubClientSecret = body.githubClientSecret
    }

    // Casdoor OAuth
    if (body.casdoorOAuthEnabled !== undefined) {
      if (typeof body.casdoorOAuthEnabled !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'casdoorOAuthEnabled 必须是布尔值'
        })
      }
      if (body.casdoorOAuthEnabled && (!body.casdoorServerUrl && !settings?.casdoorServerUrl)) {
        throw createError({ statusCode: 400, message: '启用 Casdoor 登录时必须提供服务器 URL' })
      }
      if (body.casdoorOAuthEnabled && (!body.casdoorClientId && !settings?.casdoorClientId)) {
        throw createError({ statusCode: 400, message: '启用 Casdoor 登录时必须提供 Client ID' })
      }
      if (body.casdoorOAuthEnabled && (!body.casdoorClientSecret && !settings?.casdoorClientSecret)) {
        throw createError({ statusCode: 400, message: '启用 Casdoor 登录时必须提供 Client Secret' })
      }
      if (body.casdoorOAuthEnabled && (!body.casdoorOrganizationName && !settings?.casdoorOrganizationName)) {
        throw createError({ statusCode: 400, message: '启用 Casdoor 登录时必须提供组织名称' })
      }
      updateData.casdoorOAuthEnabled = body.casdoorOAuthEnabled
    }

    if (body.casdoorServerUrl !== undefined) {
      updateData.casdoorServerUrl = body.casdoorServerUrl
    }

    if (body.casdoorClientId !== undefined) {
      updateData.casdoorClientId = body.casdoorClientId
    }

    if (body.casdoorClientSecret !== undefined && body.casdoorClientSecret !== SECRET_FIELD_MASK) {
      updateData.casdoorClientSecret = body.casdoorClientSecret
    }

    if (body.casdoorOrganizationName !== undefined) {
      updateData.casdoorOrganizationName = body.casdoorOrganizationName
    }

    // Google OAuth
    if (body.googleOAuthEnabled !== undefined) {
      if (typeof body.googleOAuthEnabled !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'googleOAuthEnabled 必须是布尔值'
        })
      }
      if (body.googleOAuthEnabled && (!body.googleClientId && !settings?.googleClientId)) {
        throw createError({ statusCode: 400, message: '启用 Google 登录时必须提供 Client ID' })
      }
      if (body.googleOAuthEnabled && (!body.googleClientSecret && !settings?.googleClientSecret)) {
        throw createError({ statusCode: 400, message: '启用 Google 登录时必须提供 Client Secret' })
      }
      updateData.googleOAuthEnabled = body.googleOAuthEnabled
    }

    if (body.googleClientId !== undefined) {
      updateData.googleClientId = body.googleClientId
    }

    if (body.googleClientSecret !== undefined && body.googleClientSecret !== SECRET_FIELD_MASK) {
      updateData.googleClientSecret = body.googleClientSecret
    }

    // Custom OAuth2
    if (body.customOAuthEnabled !== undefined) {
      if (typeof body.customOAuthEnabled !== 'boolean') {
        throw createError({
          statusCode: 400,
          message: 'customOAuthEnabled 必须是布尔值'
        })
      }
      if (body.customOAuthEnabled) {
        const requiredCustomFields = [
          { key: 'customOAuthAuthorizeUrl', label: '授权端点 URL' },
          { key: 'customOAuthTokenUrl', label: 'Token 端点 URL' },
          { key: 'customOAuthUserInfoUrl', label: '用户信息端点 URL' },
          { key: 'customOAuthClientId', label: 'Client ID' },
          { key: 'customOAuthClientSecret', label: 'Client Secret' },
          { key: 'customOAuthUserIdField', label: '用户 ID 字段名' }
        ]
        for (const field of requiredCustomFields) {
          if (!body[field.key] && !settings?.[field.key]) {
            throw createError({ statusCode: 400, message: `启用自定义 OAuth2 登录时必须提供 ${field.label}` })
          }
        }
      }
      updateData.customOAuthEnabled = body.customOAuthEnabled
    }

    if (body.customOAuthDisplayName !== undefined) {
      updateData.customOAuthDisplayName = body.customOAuthDisplayName
    }

    if (body.customOAuthAuthorizeUrl !== undefined) {
      if (body.customOAuthAuthorizeUrl) {
        try {
          new URL(body.customOAuthAuthorizeUrl)
        } catch {
          throw createError({ statusCode: 400, message: 'customOAuthAuthorizeUrl 不是合法URL' })
        }
      }
      updateData.customOAuthAuthorizeUrl = body.customOAuthAuthorizeUrl
    }

    if (body.customOAuthTokenUrl !== undefined) {
      if (body.customOAuthTokenUrl) {
        try {
          new URL(body.customOAuthTokenUrl)
        } catch {
          throw createError({ statusCode: 400, message: 'customOAuthTokenUrl 不是合法URL' })
        }
      }
      updateData.customOAuthTokenUrl = body.customOAuthTokenUrl
    }

    if (body.customOAuthUserInfoUrl !== undefined) {
      if (body.customOAuthUserInfoUrl) {
        try {
          new URL(body.customOAuthUserInfoUrl)
        } catch {
          throw createError({ statusCode: 400, message: 'customOAuthUserInfoUrl 不是合法URL' })
        }
      }
      updateData.customOAuthUserInfoUrl = body.customOAuthUserInfoUrl
    }

    if (body.customOAuthScope !== undefined) {
      updateData.customOAuthScope = body.customOAuthScope
    }

    if (body.customOAuthClientId !== undefined) {
      updateData.customOAuthClientId = body.customOAuthClientId
    }

    if (
      body.customOAuthClientSecret !== undefined
      && body.customOAuthClientSecret !== SECRET_FIELD_MASK
    ) {
      updateData.customOAuthClientSecret = body.customOAuthClientSecret
    }

    if (body.customOAuthUserIdField !== undefined) {
      updateData.customOAuthUserIdField = body.customOAuthUserIdField
    }

    if (body.customOAuthUsernameField !== undefined) {
      updateData.customOAuthUsernameField = body.customOAuthUsernameField
    }

    if (body.customOAuthNameField !== undefined) {
      updateData.customOAuthNameField = body.customOAuthNameField
    }

    if (body.customOAuthEmailField !== undefined) {
      updateData.customOAuthEmailField = body.customOAuthEmailField
    }

    if (body.customOAuthAvatarField !== undefined) {
      updateData.customOAuthAvatarField = body.customOAuthAvatarField
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

    const nextVoucherDeadline =
      body.voucherRedeemDeadlineMinutes !== undefined
        ? body.voucherRedeemDeadlineMinutes
        : settings?.voucherRedeemDeadlineMinutes
    const nextVoucherRemindWindow =
      body.voucherRemindWindowMinutes !== undefined
        ? body.voucherRemindWindowMinutes
        : settings?.voucherRemindWindowMinutes

    if (
      Number.isInteger(nextVoucherDeadline)
      && Number.isInteger(nextVoucherRemindWindow)
      && nextVoucherRemindWindow > nextVoucherDeadline
    ) {
      throw createError({
        statusCode: 400,
        message: 'voucherRemindWindowMinutes 不能大于 voucherRedeemDeadlineMinutes'
      })
    }

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

    return maskSystemSettingsSecrets(settings)
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

