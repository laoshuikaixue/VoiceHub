import { ref, computed, type Ref } from 'vue'

/** 主题类型（'System' = 跟随系统，'ClassicDark' = 经典深色，'ClassicLight' = 经典浅色，'ModernLight' = 现代浅色）*/
export type Theme = 'System' | 'ClassicDark' | 'ClassicLight' | 'ModernLight'

/** 可用主题列表（System 置顶） */
export const THEMES: Theme[] = ['System', 'ClassicDark', 'ClassicLight', 'ModernLight'] // [跟随系统, 经典深色, 经典浅色, 现代浅色]

/** 跟随系统时按系统配色偏好解析为经典深色/经典浅色 */
function resolveSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'ClassicDark' : 'ClassicLight'
}

let current: Ref<Theme> | null = null // 实际生效主题（始终为具体主题）
let selected: Ref<Theme> | null = null // 用户选择主题（可为 System）
let systemQuery: MediaQueryList | null = null
let systemChangeHandler: ((event: MediaQueryListEvent) => void) | null = null

function applyTheme(t: Theme) {
  current!.value = t
  document.documentElement.setAttribute('data-theme', t)
}

/** 注册系统配色偏好监听：系统切换时自动应用对应经典主题 */
function watchSystemTheme() {
  if (systemQuery) return
  systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemChangeHandler = () => applyTheme(resolveSystemTheme())
  systemQuery.addEventListener('change', systemChangeHandler)
}

function unwatchSystemTheme() {
  if (systemQuery && systemChangeHandler) {
    systemQuery.removeEventListener('change', systemChangeHandler)
  }
  systemQuery = null
  systemChangeHandler = null
}

/** 读取本地保存的主题，读取失败返回 null */
function readSavedTheme(): Theme | null {
  try {
    return localStorage.getItem('voicehub-theme') as Theme | null
  } catch {
    return null
  }
}

/**
 * 获取全局主题状态引用。
 * 在组件 composable 中使用，服务端返回初始值但不订阅。
 */
export function useTheme() {
  // SSR 环境返回只读 stub，避免模块级单例在 Node 进程中跨请求共享可变状态
  if (import.meta.server) {
    const currentTheme = computed(() => 'ClassicDark' as Theme)
    const selectedTheme = computed(() => 'ClassicDark' as Theme)
    const isDark = computed(() => true)
    return {
      currentTheme,
      selectedTheme,
      isDark,
      themes: THEMES,
      setTheme: () => {},
      toggleTheme: () => {}
    }
  }

  if (!current) {
    const saved: Theme | null = readSavedTheme()
    const chosen: Theme = (THEMES.includes(saved as Theme) ? saved : null) ?? 'ClassicDark'

    selected = ref<Theme>(chosen)
    current = ref<Theme>(chosen === 'System' ? resolveSystemTheme() : chosen)
    document.documentElement.setAttribute('data-theme', current.value)
    if (chosen === 'System') watchSystemTheme()
  }

  const theme = current!
  const chosen = selected!

  const currentTheme = computed(() => theme.value)
  const selectedTheme = computed(() => chosen.value)
  const isDark = computed(() => theme.value === 'ClassicDark')

  const setTheme = (t: Theme) => {
    chosen.value = t
    if (t === 'System') {
      watchSystemTheme()
      applyTheme(resolveSystemTheme())
    } else {
      unwatchSystemTheme()
      applyTheme(t)
    }
    try {
      localStorage.setItem('voicehub-theme', t)
    } catch {
      /* localStorage 写入失败（如配额满或被禁用），静默忽略 */
    }
  }

  /** 切换主题：按顺序循环切换 */
  const toggleTheme = () => {
    const nextIndex = (THEMES.indexOf(chosen.value) + 1) % THEMES.length
    setTheme(THEMES[nextIndex]!)
  }

  return {
    currentTheme,
    selectedTheme,
    isDark,
    themes: THEMES,
    setTheme,
    toggleTheme
  }
}
