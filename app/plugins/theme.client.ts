/**
 * 主题初始化与同步插件（客户端）。
 * - 恢复 localStorage 保存的主题并设置 data-theme attribute。
 * - 动态更新 <meta name="theme-color"> 以跟随 PWA 状态栏颜色。
 */
import { watch } from 'vue'
import type { Theme } from '~/composables/useTheme'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  const { currentTheme, setTheme } = useTheme()

  /** 根据主题（经典深色/经典浅色/现代浅色）更新 theme-color meta */
  function updateMeta(theme) {
    const cs = getComputedStyle(document.documentElement)
    const colorMap = {
      // 经典深色 -> 经典浅色 -> 现代浅色
      ClassicDark: cs.getPropertyValue('--bg-primary').trim() || '#111111',
      ClassicLight: cs.getPropertyValue('--bg-secondary').trim() || '#ffffff',
      ModernLight: cs.getPropertyValue('--bg-secondary').trim() || '#f5f5f5'
    }
    let meta = document.querySelector("meta[name='theme-color']")
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', colorMap[theme] || cs.getPropertyValue('--bg-primary').trim() || '#111111')
  }

  // 首次挂载时设置（useTheme 初始化时已读取 localStorage 并恢复主题，无需重复读取）
  nuxtApp.hook('vue:mounted', () => {
    document.documentElement.setAttribute('data-theme', currentTheme.value)
    updateMeta(currentTheme.value)
  })

  // 主题变化时同步更新
  watch(() => currentTheme.value, updateMeta)
})
