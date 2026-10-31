import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createTtlCache } from '~~/server/utils/ttl-cache'

/**
 * 站点统计代码注入
 * 读取后台「站点配置」中保存的统计代码片段，注入服务端渲染页面（SSR）的 <head>。
 * 支持任意统计平台（百度统计、51.la、Microsoft Clarity、Google Analytics 等）的 HTML/JS 片段。
 * 仅在整页加载（SSR / 首次hydration）时触发，客户端路由切换不会重复执行。
 *
 * 采用 createTtlCache 复用统一设置读取封装（getSystemSettingsCached），
 * 避免在渲染热路径上每次请求都查询数据库。
 * 读取失败时按关闭降级且不写缓存，下个请求重试。
 */
const CACHE_TTL_MS = 60 * 1000 // 60 秒

const getStatisticsCodeConfig = createTtlCache(
  async () => {
    const settings = await getSystemSettingsCached()
    if (!settings) {
      return null
    }
    return {
      enabled: !!settings.statisticsCodeEnabled,
      code: settings.statisticsCode || ''
    }
  },
  { enabled: false, code: '' },
  CACHE_TTL_MS
)

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html: { head: string[] }) => {
    try {
      const { enabled, code } = await getStatisticsCodeConfig()
      if (enabled && code.trim() && Array.isArray(html.head)) {
        html.head.push(code)
      }
    } catch (error) {
      // 注入失败不影响页面渲染
      console.error('[StatisticsCode] 注入统计代码失败:', error)
    }
  })
})