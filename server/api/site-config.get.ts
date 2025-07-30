import { prisma } from '../models/schema'

const defaultSubmissionGuidelines = `1. 投稿时无需加入书名号
2. 除DJ外，其他类型歌曲均接收（包括小语种）
3. 禁止投递含有违规内容的歌曲
4. 点播的歌曲将由管理员进行审核
5. 审核通过后将安排在播放时段播出
6. 提交即表明我已阅读投稿须知并已知该歌曲有概率无法播出
7. 本系统仅提供音乐搜索和播放管理功能，不存储任何音乐文件。所有音乐内容均来自第三方音乐平台，版权归原平台及版权方所有。用户点歌时请确保遵守相关音乐平台的服务条款，尊重音乐作品版权。我们鼓励用户支持正版音乐，在官方平台购买和收听喜爱的音乐作品。
8. 最终解释权归广播站所有`

export default defineEventHandler(async (event) => {
  try {
    // 获取系统设置
    let settings = await prisma.systemSettings.findFirst()
    
    if (!settings) {
      // 如果不存在设置，返回默认值
      return {
        siteTitle: process.env.NUXT_PUBLIC_SITE_TITLE || 'VoiceHub',
        siteLogoUrl: process.env.NUXT_PUBLIC_SITE_LOGO || '/favicon.ico',
        siteDescription: process.env.NUXT_PUBLIC_SITE_DESCRIPTION || '校园广播站点歌系统 - 让你的声音被听见',
        submissionGuidelines: defaultSubmissionGuidelines,
        icpNumber: ''
      }
    }
    
    // 只返回公开的站点配置信息
    return {
      siteTitle: settings.siteTitle || 'VoiceHub',
      siteLogoUrl: settings.siteLogoUrl || '/favicon.ico',
      siteDescription: settings.siteDescription || '校园广播站点歌系统 - 让你的声音被听见',
      submissionGuidelines: settings.submissionGuidelines || defaultSubmissionGuidelines,
      icpNumber: settings.icpNumber || ''
    }
  } catch (error) {
    console.error('获取站点配置失败:', error)
    
    // 发生错误时返回默认配置
    return {
      siteTitle: 'VoiceHub',
      siteLogoUrl: '/favicon.ico',
      siteDescription: '校园广播站点歌系统 - 让你的声音被听见',
      submissionGuidelines: defaultSubmissionGuidelines,
      icpNumber: ''
    }
  }
})