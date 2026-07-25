import { ref, computed, type Ref } from 'vue'

/** 主题类型 */
export type Theme = 'dark' | 'light'

/** 可用主题列表 */
export const THEMES: Theme[] = ['dark', 'light']

let current: Ref<Theme> | null = null

/**
 * 获取全局主题状态引用。
 * 在组件 composable 中使用，服务端返回初始值但不订阅。
 */
export function useTheme() {
  if (!current) {
    // 初始化状态，SSR 时默认 dark
    const saved = typeof window !== 'undefined' ? localStorage.getItem('voicehub-theme') : null
    const resolved: Theme = (THEMES.includes(saved as Theme) ? saved : null) ?? 'dark'

    current = ref<Theme>(resolved)

    // 非 SSR 环境：同步 DOM attribute
    if (import.meta.client && resolved) {
      document.documentElement.setAttribute('data-theme', resolved)
    }
  }

  const theme = current!

  const currentTheme = computed(() => theme.value)
  const isDark = computed(() => theme.value === 'dark')

  /** 设置主题并持久化到 localStorage */
  const setTheme = (t: Theme) => {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
    if (import.meta.client) {
      localStorage.setItem('voicehub-theme', t)
    }
  }

  /** 切换主题：按顺序循环切换 */
  const toggleTheme = () => {
    const nextIndex = (THEMES.indexOf(theme.value) + 1) % THEMES.length
    setTheme(THEMES[nextIndex])
  }

  return {
    currentTheme,
    isDark,
    themes: THEMES,
    setTheme,
    toggleTheme
  }
}
