import { computed } from 'vue'
import { useState } from '#imports'
import * as enUS from './en-US'
import * as zhCN from './zh-CN'

export const supportedLocales = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' }
] as const

export type Locale = typeof supportedLocales[number]['code']
type LocaleSection<T extends Record<string, string>> = {
  [Key in keyof T]: string
}

export type LocaleMessages = {
  siteConfig: LocaleSection<typeof zhCN.siteConfig>
  changePassword: LocaleSection<typeof zhCN.changePassword>
  common: LocaleSection<typeof zhCN.common>
}

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

const getCurrentLocale = () => useState<Locale>('voicehub-locale', resolveInitialLocale)

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

  return {
    currentLocale,
    supportedLocales,
    initLocale,
    setLocale,
    siteConfig: computed(() => currentMessages.value.siteConfig),
    changePassword: computed(() => currentMessages.value.changePassword),
    common: computed(() => currentMessages.value.common)
  }
}
