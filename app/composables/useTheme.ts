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
const enabledThemes = ref<Theme[]>([...THEMES])
let siteDefault: Theme = 'System'
let siteAccent: string | null = null

const ACCENT_VARS = [
  '--primary',
  '--primary-hover',
  '--primary-light',
  '--primary-border',
  '--accent-color',
  '--color-accent',
  '--color-accent-light',
  '--color-accent-hover',
  '--color-accent-light-hover',
  '--color-accent-lighter',
  '--color-accent-glow',
  '--primary-glow',
  '--primary-glow-5',
  '--primary-glow-10',
  '--primary-glow-20',
  '--primary-glow-40',
  '--primary-5',
  '--primary-10',
  '--primary-15',
  '--primary-18',
  '--primary-20',
  '--primary-25',
  '--primary-30',
  '--primary-35',
  '--primary-40',
  '--primary-50',
  '--primary-60',
  '--primary-80',
  '--primary-hover-5',
  '--primary-hover-10',
  '--primary-hover-20',
  '--primary-hover-30',
  '--color-accent-alpha-10',
  '--color-accent-alpha-12',
  '--color-accent-alpha-15',
  '--color-accent-alpha-18',
  '--color-accent-alpha-20',
  '--color-accent-alpha-22',
  '--color-accent-alpha-25',
  '--color-accent-alpha-30',
  '--color-accent-alpha-40',
  '--color-accent-alpha-50',
  '--color-accent-alpha-60',
  '--color-accent-alpha-65',
  '--color-accent-alpha-80',
  '--title-divider-bg',
  '--text-link',
  '--text-link-hover',
  '--panel-border-active',
  '--panel-border-brand',
  '--status-info-border',
  '--selection-bg',
  '--like-btn-border',
  '--like-btn-hover-bg',
  '--user-manager-tree-active-bg',
  '--requestform-audio-match-hover-border',
  '--requestform-audio-match-hover-border-light',
  '--requestform-login-btn-hover-shadow',
  '--requestform-login-btn-hover-shadow-lg',
  '--schedule-list-title-shadow',
  '--data-analysis-scroll-thumb',
]

/** 归一化 HEX 颜色为 #rrggbb，非法值返回 null */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(input)
  if (short) {
    const [r, g, b] = short[1]!.split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return /^#[0-9a-fA-F]{6}$/.test(input) ? input.toLowerCase() : null
}

/** 应用站点强调色；传入空值恢复主题默认色 */
export function applyAccentColor(value: unknown) {
  if (import.meta.server) return
  siteAccent = normalizeHexColor(value)
  const root = document.documentElement
  if (!siteAccent) {
    for (const name of ACCENT_VARS) root.style.removeProperty(name)
    return
  }

  const hex = siteAccent
  const hover = `color-mix(in srgb, ${hex} 86%, #000)`
  const alpha = (percent: number) => `color-mix(in srgb, ${hex} ${percent}%, transparent)`
  const values: Record<string, string> = {
    '--primary': hex,
    '--primary-hover': hover,
    '--primary-light': alpha(10),
    '--primary-border': alpha(20),
    '--accent-color': hex,
    '--color-accent': hex,
    '--color-accent-light': `color-mix(in srgb, ${hex} 88%, #fff)`,
    '--color-accent-hover': hover,
    '--color-accent-light-hover': `color-mix(in srgb, ${hover} 88%, #fff)`,
    '--color-accent-lighter': `color-mix(in srgb, ${hex} 70%, #fff)`,
    '--color-accent-glow': alpha(40),
    '--primary-glow': alpha(15),
    '--primary-glow-5': alpha(5),
    '--primary-glow-10': alpha(10),
    '--primary-glow-20': alpha(20),
    '--primary-glow-40': alpha(30),
    '--primary-5': alpha(5),
    '--primary-10': alpha(10),
    '--primary-15': alpha(15),
    '--primary-18': alpha(18),
    '--primary-20': alpha(20),
    '--primary-25': alpha(25),
    '--primary-30': alpha(30),
    '--primary-35': alpha(35),
    '--primary-40': alpha(40),
    '--primary-50': alpha(50),
    '--primary-60': alpha(60),
    '--primary-80': alpha(80),
    '--primary-hover-5': `color-mix(in srgb, ${hover} 5%, transparent)`,
    '--primary-hover-10': `color-mix(in srgb, ${hover} 10%, transparent)`,
    '--primary-hover-20': `color-mix(in srgb, ${hover} 20%, transparent)`,
    '--primary-hover-30': `color-mix(in srgb, ${hover} 30%, transparent)`,
    '--color-accent-alpha-10': alpha(8),
    '--color-accent-alpha-12': alpha(12),
    '--color-accent-alpha-15': alpha(15),
    '--color-accent-alpha-18': alpha(18),
    '--color-accent-alpha-20': alpha(16),
    '--color-accent-alpha-22': alpha(22),
    '--color-accent-alpha-25': alpha(25),
    '--color-accent-alpha-30': alpha(25),
    '--color-accent-alpha-40': alpha(30),
    '--color-accent-alpha-50': alpha(40),
    '--color-accent-alpha-60': alpha(50),
    '--color-accent-alpha-65': alpha(65),
    '--color-accent-alpha-80': alpha(60),
    '--title-divider-bg': hex,
    '--text-link': hex,
    '--text-link-hover': hover,
    '--panel-border-active': hex,
    '--panel-border-brand': hex,
    '--status-info-border': hex,
    '--selection-bg': alpha(25),
    '--like-btn-border': alpha(45),
    '--like-btn-hover-bg': alpha(6),
    '--user-manager-tree-active-bg': alpha(16),
    '--requestform-audio-match-hover-border': alpha(35),
    '--requestform-audio-match-hover-border-light': alpha(22),
    '--requestform-login-btn-hover-shadow': alpha(35),
    '--requestform-login-btn-hover-shadow-lg': alpha(45),
    '--schedule-list-title-shadow': alpha(30),
    '--data-analysis-scroll-thumb': alpha(30),
  }
  for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value)
}

function applyTheme(t: Theme) {
  current!.value = t
  document.documentElement.setAttribute('data-theme', t)
  applyAccentColor(siteAccent)
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
      themes: computed(() => enabledThemes.value),
      setTheme: () => {},
      toggleTheme: () => {}
    }
  }

  if (!current) {
    const saved: Theme | null = readSavedTheme()
    // 用户保存的主题被禁用时回退到站点默认；回退结果不写回 localStorage，避免把系统代选固化为用户偏好
    const chosen: Theme = (THEMES.includes(saved as Theme) && enabledThemes.value.includes(saved as Theme) ? saved : null) ?? siteDefault

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
    if (!enabledThemes.value.includes(t)) return
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
    const availableThemes = enabledThemes.value
    const nextIndex = (availableThemes.indexOf(chosen.value) + 1) % availableThemes.length
    setTheme(availableThemes[nextIndex]!)
  }

  return {
    currentTheme,
    selectedTheme,
    isDark,
    themes: enabledThemes,
    setTheme,
    toggleTheme
  }
}

/** 应用服务端主题策略；用户已保存的主题优先于站点默认主题。 */
export function applyThemeConfig(
  defaultTheme: unknown,
  configuredThemes: unknown,
  accentColor: unknown = null
) {
  if (import.meta.server) return
  applyAccentColor(accentColor)
  if (!current || !selected) {
    console.warn('applyThemeConfig: useTheme 尚未初始化，主题配置暂不生效')
    return
  }
  const nextEnabled = Array.isArray(configuredThemes)
    ? THEMES.filter((theme) => configuredThemes.includes(theme))
    : [...THEMES]
  enabledThemes.value = nextEnabled.length > 0 ? nextEnabled : [...THEMES]
  if (enabledThemes.value.includes('System') && (!enabledThemes.value.includes('ClassicDark') || !enabledThemes.value.includes('ClassicLight'))) {
    enabledThemes.value = enabledThemes.value.filter((theme) => theme !== 'System')
  }
  if (enabledThemes.value.length === 0) {
    enabledThemes.value = [...THEMES]
  }
  siteDefault = THEMES.includes(defaultTheme as Theme) && enabledThemes.value.includes(defaultTheme as Theme)
    ? defaultTheme as Theme
    : enabledThemes.value.includes('System') ? 'System' : enabledThemes.value[0]!
  const saved = readSavedTheme()
  const next = THEMES.includes(saved as Theme) && enabledThemes.value.includes(saved as Theme)
    ? saved as Theme
    : siteDefault
  // 用户保存的主题被禁用时回退到站点默认；回退结果不写回 localStorage，避免把系统代选固化为用户偏好
  selected.value = next
  if (next === 'System') {
    watchSystemTheme()
    applyTheme(resolveSystemTheme())
  } else {
    unwatchSystemTheme()
    applyTheme(next)
  }
}
