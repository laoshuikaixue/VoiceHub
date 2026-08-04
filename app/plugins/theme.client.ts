/**
 * 主题初始化与同步插件（客户端）。
 * - 恢复 localStorage 保存的主题并设置 data-theme attribute。
 * - 动态更新 <meta name="theme-color"> 以跟随 PWA 状态栏颜色。
 */
import { watch } from 'vue'
import type { Theme } from '~/composables/useTheme'
import { THEMES } from '~/composables/useTheme'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  const { currentTheme, setTheme } = useTheme()

  /** 根据主题（经典深色/经典浅色）更新 theme-color meta */
  function updateMeta(theme) {
    const cs = getComputedStyle(document.documentElement)
    const colorMap = {
      // 经典深色 -> 经典浅色
      dark: cs.getPropertyValue('--bg-primary').trim() || '#111111',
      light: cs.getPropertyValue('--bg-secondary').trim() || '#ffffff'
    }
    let meta = document.querySelector("meta[name='theme-color']")
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', colorMap[theme] || cs.getPropertyValue('--bg-primary').trim() || '#111111')
  }

  // 应用 saved theme
  let saved: Theme | null = null
  try {
    saved = localStorage.getItem('voicehub-theme') as Theme
  } catch {
    // localStorage 不可用，静默降级
  }
  if (saved && THEMES.includes(saved)) {
    setTheme(saved)
  }

  // 首次挂载时设置
  nuxtApp.hook('vue:mounted', () => {
    document.documentElement.setAttribute('data-theme', currentTheme.value)
    updateMeta(currentTheme.value)
  })

  // 主题变化时同步更新
  watch(() => currentTheme.value, updateMeta)
})
