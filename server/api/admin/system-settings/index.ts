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
      message: '只有管理员才能查看系统设置'
    })
  }
  
  try {
    // 获取系统设置，如果不存在则创建默认设置
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          enablePlayTimeSelection: false,
          siteTitle: process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub',
          siteLogoUrl: process.env.NUXT_PUBLIC_SITE_LOGO || '/favicon.ico',
          schoolLogoHomeUrl: null,
          schoolLogoPrintUrl: null,
          siteDescription: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见',
          submissionGuidelines: '请遵守校园规定，提交健康向上的歌曲。',
          icpNumber: null
        }
      })
    }
    
    return settings
  } catch (error) {
    console.error('获取系统设置失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取系统设置失败'
    })
  }
})