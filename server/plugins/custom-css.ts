import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import { sanitizeCustomCss } from '~/utils/custom-css-policy'

/**
 * 自定义 CSS 注入
 * 读取后台「站点配置 → 自定义样式」保存的 CSS，作为最后一个 <style> 注入 SSR 页面 <head>，
 * 因此可直接覆盖主题 CSS 变量与 UnoCSS 原子类。仅在整页加载时触发，客户端路由切换不重复注入。
 * 采用模块级 TTL 缓存 + in-flight 去重（与统计代码注入同一口径），避免渲染热路径每次查库。
 * 读取失败时按关闭降级且不写缓存，下个请求重试。
 * 备份恢复等旁路写入不经过保存接口校验，注入前一律过 sanitizeCustomCss 兜底。
 */
const CACHE_TTL_MS = 60 * 1000 // 60 秒

let cache: {
  enabled: boolean
  css: string
} | null = null

let cacheFetchedAt = 0
let inFlight: Promise<{ enabled: boolean; css: string }> | null = null

async function getCustomCssConfig(): Promise<{
  enabled: boolean
  css: string
}> {
  const now = getServerTimestamp()
  if (cache && now - cacheFetchedAt < CACHE_TTL_MS) {
    return cache
  }

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const settings = await getSystemSettingsCached()
        if (!settings) {
          return { enabled: false, css: '' }
        }
        cache = {
          enabled: !!settings.customCssEnabled,
          css: settings.customCss || ''
        }
        cacheFetchedAt = getServerTimestamp()
        return cache
      } finally {
        inFlight = null
      }
    })()
  }

  return inFlight
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html: { head: string[] }) => {
    try {
      const { enabled, css } = await getCustomCssConfig()
      const safeCss = sanitizeCustomCss(css)
      if (enabled && safeCss.trim() && Array.isArray(html.head)) {
        html.head.push(`<style data-custom-css>${safeCss}</style>`)
      }
    } catch (error) {
      // 注入失败不影响页面渲染
      console.error('[CustomCss] 注入自定义 CSS 失败:', error)
    }
  })
})
