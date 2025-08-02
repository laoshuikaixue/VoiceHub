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

    if (body.schoolLogoUrl !== undefined) {
      updateData.schoolLogoUrl = body.schoolLogoUrl
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
    
    // 获取当前设置，如果不存在则创建
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      // 如果不存在，创建新设置
      settings = await prisma.systemSettings.create({
        data: {
          enablePlayTimeSelection: updateData.enablePlayTimeSelection ?? false,
          siteTitle: updateData.siteTitle ?? 'VoiceHub',
          siteLogoUrl: updateData.siteLogoUrl ?? '/favicon.ico',
          schoolLogoUrl: updateData.schoolLogoUrl ?? null,
          siteDescription: updateData.siteDescription ?? '校园广播站点歌系统 - 让你的声音被听见',
          submissionGuidelines: updateData.submissionGuidelines ?? '请遵守校园规定，提交健康向上的歌曲。',
          icpNumber: updateData.icpNumber ?? null
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