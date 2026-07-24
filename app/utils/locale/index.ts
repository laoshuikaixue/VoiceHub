import { computed, ref } from 'vue'
import * as zhCN from './zh-CN'

export const supportedLocales = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' }
] as const

export type Locale = typeof supportedLocales[number]['code']
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
export const FALLBACK_LOCALE: Locale = 'zh-CN'

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

// 客户端语言解析：本地存储（历史偏好迁移）→ 浏览器语言 → 兜底。
export function resolveClientInitialLocale(): Locale {
  if (!import.meta.client) return FALLBACK_LOCALE

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isSupportedLocale(savedLocale)) return savedLocale

  const browserLocale = window.navigator.language
  if (isSupportedLocale(browserLocale)) return browserLocale
  if (browserLocale?.toLowerCase().startsWith('zh')) return 'zh-CN'
  if (browserLocale?.toLowerCase().startsWith('en')) return 'en-US'

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

export function setLocale(locale: Locale) {
  if (!isSupportedLocale(locale)) return

  // 与读取路径解耦：存在 Nuxt 上下文时更新 useState（请求隔离），
  // 客户端另同步模块级回退 ref，避免两者出现 split-brain 导致部分消费者收不到切换。
  if (tryUseNuxtApp()) {
    useState<Locale>('voicehub-locale', () => fallbackLocaleRef.value).value = locale
  }
  // 触发目标语言词典的按需加载；加载完成后相关 computed 会自动更新。
  void loadLocaleMessages(locale)

  if (import.meta.client) {
    // 客户端同步模块级回退 ref，使在模块加载期实例化的单例（如共享歌词实例）也能响应语言切换。
    fallbackLocaleRef.value = locale
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // 忽略隐私模式等场景下的持久化失败
    }
  }
}

export function useLocale() {
  const currentLocale = getCurrentLocale()
  const withFallback = <Key extends keyof LocaleMessages>(key: Key) =>
    computed(() => getMergedSection(currentLocale.value, key))

  return {
    currentLocale,
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
    serverErrors: withFallback('serverErrors')
  }
}
