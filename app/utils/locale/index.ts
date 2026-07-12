import { computed, ref } from 'vue'
import * as enUS from './en-US'
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
const FALLBACK_LOCALE: Locale = 'zh-CN'

const messages: Record<Locale, LocaleMessages> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

const isSupportedLocale = (locale: string | null | undefined): locale is Locale =>
  supportedLocales.some((item) => item.code === locale)

const resolveInitialLocale = (): Locale => {
  if (!import.meta.client) return FALLBACK_LOCALE

  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (isSupportedLocale(savedLocale)) return savedLocale

  const browserLocale = window.navigator.language
  if (isSupportedLocale(browserLocale)) return browserLocale
  if (browserLocale?.toLowerCase().startsWith('zh')) return 'zh-CN'
  if (browserLocale?.toLowerCase().startsWith('en')) return 'en-US'

  return FALLBACK_LOCALE
}

// 首次客户端渲染必须与服务端保持一致，避免读取本地偏好后产生水合不匹配。
// 用户偏好在应用挂载后由 initLocale() 恢复。
const currentLocaleState = ref<Locale>(FALLBACK_LOCALE)

const getCurrentLocale = () => currentLocaleState

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

export function initLocale() {
  if (!import.meta.client) return
  setLocale(resolveInitialLocale())
}

export function setLocale(locale: Locale) {
  if (!isSupportedLocale(locale)) return

  const currentLocale = getCurrentLocale()
  currentLocale.value = locale
  if (import.meta.client) {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }
}

export function useLocale() {
  const currentLocale = getCurrentLocale()
  const currentMessages = computed(() => messages[currentLocale.value] ?? messages[FALLBACK_LOCALE])
  const fallbackMessages = messages[FALLBACK_LOCALE]
  const withFallback = <Key extends keyof LocaleMessages>(key: Key) =>
    computed(() => mergeLocaleFallback(
      getLocaleSection(fallbackMessages, key),
      getLocaleSection(currentMessages.value, key)
    ))

  return {
    currentLocale,
    supportedLocales,
    initLocale,
    setLocale,
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
    yearReview: withFallback('yearReview')
  }
}
