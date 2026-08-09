import { computed, ref } from 'vue'
import * as zhCN from './zh-CN'

export const supportedLocales = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' }
] as const

export type Locale = (typeof supportedLocales)[number]['code']
type LocaleValue<T> = T extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : T extends readonly (infer Item)[]
    ? readonly LocaleValue<Item>[]
    : T extends string
      ? string
      : T extends object
        ? { [Key in keyof T]: LocaleValue<T[Key]> }
        : T

export type LocaleMessages = LocaleValue<typeof zhCN>
type LocaleSectionKey = keyof LocaleMessages
type LegacyNestedSectionKey = 'auth' | 'ui' | 'songs'

const LOCALE_STORAGE_KEY = 'voicehub.locale'
export const LOCALE_COOKIE_KEY = 'voicehub.locale'
// 语言偏好来源：'manual' = 用户手动选择（长期记住），'system' = 自动跟随系统（每次进入重新解析）
export const LOCALE_PREFERENCE_KEY = 'voicehub.locale.pref'
export type LocalePreference = 'manual' | 'system'
export const FALLBACK_LOCALE: Locale = 'zh-CN'

// 语言 cookie 共用配置（长期有效，跟随手动/系统模式一起写入）
const localeCookieOptions = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
  path: '/'
}

export const isSupportedLocale = (locale: string | null | undefined): locale is Locale =>
  supportedLocales.some((item) => item.code === locale)

// 词典按需加载：中文作为兜底与合并基底静态内置，其余语言在被激活时才动态加载，
// 避免默认语言用户下载不需要的语言包。
const zhMessages = zhCN as unknown as LocaleMessages

const localeLoaders: Record<Locale, () => Promise<LocaleMessages>> = {
  'zh-CN': () => Promise.resolve(zhMessages),
  'en-US': () => import('./en-US').then((module) => module as unknown as LocaleMessages)
}

// 已加载词典缓存。词典内容不可变，可在服务端跨请求安全共享（只做追加）。
const loadedMessages = ref<Partial<Record<Locale, LocaleMessages>>>({
  'zh-CN': zhMessages
})
const loadingPromises: Partial<Record<Locale, Promise<LocaleMessages>>> = {}

export function isLocaleMessagesLoaded(locale: Locale): boolean {
  return Boolean(loadedMessages.value[locale])
}

export async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (!isSupportedLocale(locale) || loadedMessages.value[locale]) return

  if (!loadingPromises[locale]) {
    loadingPromises[locale] = localeLoaders[locale]().then((module) => {
      loadedMessages.value = { ...loadedMessages.value, [locale]: module }
      return module
    })
  }

  await loadingPromises[locale]
}

// 客户端语言解析：用户手动偏好（localStorage）→ 浏览器/系统语言 → 兜底。
// 自动跟随系统的解析结果不写入 localStorage，系统语言变化后才能重新跟随。
export function resolveClientInitialLocale(): Locale {
  if (!import.meta.client) return FALLBACK_LOCALE

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  const preference = window.localStorage.getItem(LOCALE_PREFERENCE_KEY)
  if (preference === 'manual' && isSupportedLocale(savedLocale)) return savedLocale

  // navigator.languages 为浏览器首选语言列表（通常跟随系统语言），逐项匹配更准确
  const browserLanguages =
    window.navigator.languages?.length > 0 ? window.navigator.languages : [window.navigator.language]
  for (const language of browserLanguages) {
    if (!language) continue
    if (isSupportedLocale(language)) return language
    const normalized = language.toLowerCase()
    if (normalized.startsWith('zh')) return 'zh-CN'
    if (normalized.startsWith('en')) return 'en-US'
  }

  return FALLBACK_LOCALE
}

// 服务端语言解析：根据 Accept-Language 头选择最合适的受支持语言。
export function resolveLocaleFromAcceptLanguage(header?: string | null): Locale {
  if (!header) return FALLBACK_LOCALE

  // 解析 (语言, q 权重) 对，缺省 q=1，按 q 稳定降序后再匹配；
  // 否则会忽略权重，对 `zh;q=0.1,en;q=0.9` 这类头选错语言。
  const languages = header
    .split(',')
    .map((part) => {
      const [lang, ...params] = part.trim().split(';')
      const qParam = params.find((p) => p.trim().startsWith('q='))
      const q = qParam ? Number(qParam.split('=')[1]) : 1
      return { lang: lang?.trim().toLowerCase() ?? '', q: Number.isFinite(q) ? q : 0 }
    })
    .filter((item) => item.lang)
    .sort((a, b) => b.q - a.q)

  for (const { lang } of languages) {
    if (lang.startsWith('zh')) return 'zh-CN'
    if (lang.startsWith('en')) return 'en-US'
  }

  return FALLBACK_LOCALE
}

// 当前语言状态：
// - 在 Nuxt 上下文内用 useState：SSR 下每个请求相互隔离，客户端首屏自动水合，避免模块级 ref 造成的跨请求串扰；
// - 在 Nuxt 上下文外（如个别 composable 在模块加载期即被实例化）回退到模块级 ref，避免 useState 脱离 Nuxt 实例而报错。
// 注意：服务端的模块级 ref 为所有请求共享，但它仅在「无 Nuxt 上下文」的模块初始化期被读取（此时尚无请求态语言），
// 且 setLocale 在服务端不会写它（见下），因此只会返回兜底默认值，不存在跨请求语言串扰。
const fallbackLocaleRef = ref<Locale>(FALLBACK_LOCALE)
const getCurrentLocale = () =>
  tryUseNuxtApp()
    ? useState<Locale>('voicehub-locale', () => fallbackLocaleRef.value)
    : fallbackLocaleRef

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const mergeLocaleFallback = <T>(fallbackValue: T, currentValue: unknown): T => {
  if (Array.isArray(fallbackValue) || typeof fallbackValue === 'function') {
    return (currentValue ?? fallbackValue) as T
  }

  if (!isPlainObject(fallbackValue)) {
    return (currentValue ?? fallbackValue) as T
  }

  const currentObject = isPlainObject(currentValue) ? currentValue : {}
  const merged = { ...fallbackValue } as Record<string, unknown>

  for (const key of Object.keys(currentObject)) {
    merged[key] = currentObject[key]
  }

  for (const [key, value] of Object.entries(fallbackValue)) {
    merged[key] = mergeLocaleFallback(value, currentObject[key])
  }

  return merged as T
}

const getLocaleSection = <Key extends LocaleSectionKey>(
  localeMessages: LocaleMessages,
  key: Key
) => {
  const section = localeMessages[key]

  // 兼容早期迁移时 auth/ui/songs 被临时挂在 pages 下的结构，避免 SSR 首屏读取空对象崩溃。
  if (
    section === undefined &&
    (key === 'auth' || key === 'ui' || key === 'songs') &&
    isPlainObject(localeMessages.pages)
  ) {
    return localeMessages.pages[key as LegacyNestedSectionKey] as LocaleMessages[Key]
  }

  return section
}

// 合并结果缓存：词典内容不可变，(语言, 段) 的深合并结果只需计算一次。
// 仅在目标语言词典「已真正加载」后才缓存，避免把「加载完成前的临时回退结果」错误固化。
const mergedSectionCache = new Map<string, unknown>()

const getMergedSection = <Key extends LocaleSectionKey>(
  locale: Locale,
  key: Key
): LocaleMessages[Key] => {
  const loaded = loadedMessages.value[locale]
  const currentMessages = loaded ?? zhMessages
  const computeMerged = () =>
    mergeLocaleFallback(getLocaleSection(zhMessages, key), getLocaleSection(currentMessages, key))

  // 目标语言尚未加载完成时，实时合并且不缓存；待加载完成后再固化正确结果。
  if (!loaded) return computeMerged()

  const cacheKey = `${locale}:${String(key)}`
  const cached = mergedSectionCache.get(cacheKey)
  if (cached !== undefined) return cached as LocaleMessages[Key]

  const result = computeMerged()
  mergedSectionCache.set(cacheKey, result)
  return result
}

export function setLocale(locale: Locale, manual = false) {
  if (!isSupportedLocale(locale)) return

  // 与读取路径解耦：存在 Nuxt 上下文时更新 useState（请求隔离），
  // 客户端另同步模块级回退 ref，避免两者出现 split-brain 导致部分消费者收不到切换。
  if (tryUseNuxtApp()) {
    useState<Locale>('voicehub-locale', () => fallbackLocaleRef.value).value = locale
    // 语言与偏好来源写入 cookie：manual 长期记住；system 仅本次会话，下次进入重新跟随系统语言
    const localeCookie = useCookie<Locale | undefined>(LOCALE_COOKIE_KEY, localeCookieOptions)
    const preferenceCookie = useCookie<LocalePreference | undefined>(
      LOCALE_PREFERENCE_KEY,
      localeCookieOptions
    )
    localeCookie.value = locale
    preferenceCookie.value = manual ? 'manual' : 'system'
  }
  // 触发目标语言词典的按需加载；加载完成后相关 computed 会自动更新。
  void loadLocaleMessages(locale)

  if (import.meta.client) {
    // 客户端同步模块级回退 ref，使在模块加载期实例化的单例（如共享歌词实例）也能响应语言切换。
    fallbackLocaleRef.value = locale
    if (manual) {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
        window.localStorage.setItem(LOCALE_PREFERENCE_KEY, 'manual')
      } catch {
        // 忽略隐私模式等场景下的持久化失败
      }
    }
  }
}

// 切换到跟随系统模式：清除手动偏好并立即按系统语言切换。
export function followSystemLocale(): Locale {
  if (import.meta.client) {
    try {
      window.localStorage.removeItem(LOCALE_STORAGE_KEY)
      window.localStorage.removeItem(LOCALE_PREFERENCE_KEY)
    } catch {
      // 忽略隐私模式等场景下的清除失败
    }
  }
  // 清除偏好后再解析，确保取到的是系统语言而非历史手动选择
  const resolved = import.meta.client ? resolveClientInitialLocale() : FALLBACK_LOCALE
  setLocale(resolved, false)
  return resolved
}

export function useLocale() {
  const currentLocale = getCurrentLocale()
  // 偏好来源标志（manual=用户手动选择 / system=跟随系统）；无 Nuxt 上下文（模块加载期）时视为跟随系统
  const preferenceCookie = tryUseNuxtApp()
    ? useCookie<LocalePreference | undefined>(LOCALE_PREFERENCE_KEY, localeCookieOptions)
    : null
  // 当前是否为「跟随系统」模式（未手动选择过语言）
  const isFollowingSystem = computed(() => preferenceCookie?.value !== 'manual')
  const withFallback = <Key extends keyof LocaleMessages>(key: Key) =>
    computed(() => getMergedSection(currentLocale.value, key))

  return {
    currentLocale,
    isFollowingSystem,
    followSystemLocale,
    supportedLocales,
    setLocale,
    loadLocaleMessages,
    siteConfig: withFallback('siteConfig'),
    changePassword: withFallback('changePassword'),
    common: withFallback('common'),
    pages: withFallback('pages'),
    auth: withFallback('auth'),
    ui: withFallback('ui'),
    audioPlayer: withFallback('audioPlayer'),
    composableErrors: withFallback('composableErrors'),
    songs: withFallback('songs'),
    admin: withFallback('admin'),
    yearReview: withFallback('yearReview'),
    serverErrors: withFallback('serverErrors'),
    theme: withFallback('theme') as unknown as typeof import('./zh-CN').theme,
    importantNotification: withFallback('importantNotification')
  }
}
