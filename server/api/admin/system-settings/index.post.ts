import { prisma } from '../../../models/schema'

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
      if (body.dailySubmissionLimit !== null && (!Number.isInteger(body.dailySubmissionLimit) || body.dailySubmissionLimit < 0)) {
        throw createError({
          statusCode: 400,
          message: 'dailySubmissionLimit 必须是非负整数或null'
        })
      }
      updateData.dailySubmissionLimit = body.dailySubmissionLimit
    }
    
    if (body.weeklySubmissionLimit !== undefined) {
      if (body.weeklySubmissionLimit !== null && (!Number.isInteger(body.weeklySubmissionLimit) || body.weeklySubmissionLimit < 0)) {
        throw createError({
          statusCode: 400,
          message: 'weeklySubmissionLimit 必须是非负整数或null'
        })
      }
      updateData.weeklySubmissionLimit = body.weeklySubmissionLimit
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
    
    // 验证每日和每周限额不能同时设置
    if (body.enableSubmissionLimit && 
        body.dailySubmissionLimit !== undefined && 
        body.weeklySubmissionLimit !== undefined &&
        body.dailySubmissionLimit !== null && 
        body.weeklySubmissionLimit !== null &&
        body.dailySubmissionLimit > 0 && 
        body.weeklySubmissionLimit > 0) {
      throw createError({
        statusCode: 400,
        message: '每日限额和每周限额不能同时设置，请选择其中一种'
      })
    }
    
    // 获取当前设置，如果不存在则创建
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      // 如果不存在，创建新设置
      settings = await prisma.systemSettings.create({
        data: {
          enablePlayTimeSelection: updateData.enablePlayTimeSelection ?? false,
          siteTitle: updateData.siteTitle ?? 'VoiceHub',
          siteLogoUrl: updateData.siteLogoUrl ?? '/favicon.ico',
          schoolLogoHomeUrl: updateData.schoolLogoHomeUrl ?? null,
          schoolLogoPrintUrl: updateData.schoolLogoPrintUrl ?? null,
          siteDescription: updateData.siteDescription ?? '校园广播站点歌系统 - 让你的声音被听见',
          submissionGuidelines: updateData.submissionGuidelines ?? '请遵守校园规定，提交健康向上的歌曲。',
          icpNumber: updateData.icpNumber ?? null,
          enableSubmissionLimit: updateData.enableSubmissionLimit ?? false,
          dailySubmissionLimit: updateData.dailySubmissionLimit ?? null,
          weeklySubmissionLimit: updateData.weeklySubmissionLimit ?? null,
          showBlacklistKeywords: updateData.showBlacklistKeywords ?? false
        }
      })
    } else {
      // 如果存在，更新设置
      settings = await prisma.systemSettings.update({
        where: {
          id: settings.id
        },
        data: updateData
      })
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