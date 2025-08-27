import { db } from '~/drizzle/db'
import { CacheService } from '../../../services/cacheService'

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
    
    // 验证每日和每周限额二选一逻辑
    if (body.enableSubmissionLimit && 
        body.dailySubmissionLimit !== undefined && 
        body.weeklySubmissionLimit !== undefined &&
        body.dailySubmissionLimit !== null && 
        body.weeklySubmissionLimit !== null) {
      throw createError({
        statusCode: 400,
        message: '每日限额和每周限额只能选择其中一种，另一种必须设置为空'
      })
    }
    
    // 获取当前设置，如果不存在则创建
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      // 如果不存在，创建新设置
      settings = await prisma.systemSettings.create({
        data: {
          hideStudentInfo: updateData.hideStudentInfo ?? false,
          enablePlayTimeSelection: updateData.enablePlayTimeSelection ?? false,
          siteTitle: updateData.siteTitle ?? 'VoiceHub',
          siteLogoUrl: updateData.siteLogoUrl ?? '/favicon.ico',
          schoolLogoHomeUrl: updateData.schoolLogoHomeUrl ?? null,
          schoolLogoPrintUrl: updateData.schoolLogoPrintUrl ?? null,
          siteDescription: updateData.siteDescription ?? '校园广播站点歌系统 - 让你的声音被听见',
          submissionGuidelines: updateData.submissionGuidelines ?? `1. 投稿时无需加入书名号
2. 除DJ外，其他类型歌曲均接收（包括小语种）
3. 禁止投递含有违规内容的歌曲
4. 点播的歌曲将由管理员进行审核
5. 审核通过后将安排在播放时段播出
6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。
8. 最终解释权归广播站所有`,
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
    
    // 清除系统设置缓存
    try {
      const { cache } = await import('~/server/utils/cache-helpers')
      await cache.delete('system:config')
      console.log('[Cache] 系统设置缓存已清除（更新系统设置）')
    } catch (cacheError) {
      console.warn('清除系统设置缓存失败:', cacheError)
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