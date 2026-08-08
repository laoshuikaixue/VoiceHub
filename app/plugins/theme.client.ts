/**
 * 主题同步插件（客户端）。
 * - 更新 <meta name="theme-color"> 以跟随 PWA 状态栏颜色。
 * - data-theme attribute 由 useTheme() 初始化和 setTheme() 统一管理，本插件不再重复设置。
 */
import { watch } from 'vue'
import type { Theme } from '~/composables/useTheme'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  const { currentTheme } = useTheme()

  /** 根据主题（经典深色/经典浅色/现代浅色）更新 theme-color meta */
  function updateMeta(theme) {
    const cs = getComputedStyle(document.documentElement)
    const colorMap = {
      // 经典深色 -> 经典浅色 -> 现代浅色（统一使用 --bg-primary 作为页面主背景色）
      ClassicDark: cs.getPropertyValue('--bg-primary').trim() || '#111111',
      ClassicLight: cs.getPropertyValue('--bg-primary').trim() || '#fafafa',
      ModernLight: cs.getPropertyValue('--bg-primary').trim() || '#fcfcfa'
    }
    let meta = document.querySelector("meta[name='theme-color']")
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', colorMap[theme] || cs.getPropertyValue('--bg-primary').trim() || '#111111')
  }

  // 首次挂载时更新 theme-color meta（data-theme attribute 由 useTheme() 初始化和 setTheme() 统一管理，无需在此重复设置）
  nuxtApp.hook('vue:mounted', () => {
    updateMeta(currentTheme.value)
  })

  // 主题变化时同步更新
  watch(() => currentTheme.value, updateMeta)
})
