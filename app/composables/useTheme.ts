import { ref, computed, type Ref } from 'vue'

/** 主题类型（'ClassicDark' = 经典深色，'ClassicLight' = 经典浅色，'ModernLight' = 现代浅色）*/
export type Theme = 'ClassicDark' | 'ClassicLight' | 'ModernLight'

/** 可用主题列表 */
export const THEMES: Theme[] = ['ClassicDark', 'ClassicLight', 'ModernLight'] // [经典深色, 经典浅色, 现代浅色]

let current: Ref<Theme> | null = null

/**
 * 获取全局主题状态引用。
 * 在组件 composable 中使用，服务端返回初始值但不订阅。
 */
export function useTheme() {
  // SSR 环境返回只读 stub，避免模块级单例在 Node 进程中跨请求共享可变状态
  if (import.meta.server) {
    const currentTheme = computed(() => 'ClassicDark' as Theme)
    const isDark = computed(() => true)
    return {
      currentTheme,
      isDark,
      themes: THEMES,
      setTheme: () => {},
      toggleTheme: () => {}
    }
  }

  if (!current) {
    let saved = null
    try {
      saved = localStorage.getItem('voicehub-theme')
    } catch {
      saved = null
    }
    const resolved: Theme = (THEMES.includes(saved as Theme) ? saved : null) ?? 'ClassicDark'

    current = ref<Theme>(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }

  const theme = current!

  const currentTheme = computed(() => theme.value)
  const isDark = computed(() => theme.value === 'ClassicDark')

  const setTheme = (t: Theme) => {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
    try {
      localStorage.setItem('voicehub-theme', t)
    } catch {
      /* localStorage 写入失败（如配额满或被禁用），静默忽略 */
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
