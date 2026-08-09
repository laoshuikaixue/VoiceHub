import {
  LOCALE_COOKIE_KEY,
  LOCALE_PREFERENCE_KEY,
  isSupportedLocale,
  loadLocaleMessages,
  resolveClientInitialLocale,
  resolveLocaleFromAcceptLanguage,
  setLocale,
  useLocale,
  type Locale,
  type LocalePreference
} from '~/utils/locale'

// 语言初始化插件（服务端 + 客户端通用）。
// - 仅当用户手动选择过语言（偏好为 manual）时信任 cookie 中保存的语言；
//   否则每次进入都按 Accept-Language / 浏览器语言跟随系统语言，系统语言变化后自动切换。
// - 客户端沿用服务端解析结果（cookie）以保证水合一致，cookie 缺失时才按浏览器语言解析。
// 在渲染前 await 目标语言词典，避免懒加载导致的水合不匹配。
export default defineNuxtPlugin(async () => {
  const { currentLocale } = useLocale()
  const localeCookie = useCookie<Locale | undefined>(LOCALE_COOKIE_KEY, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/'
  })
  const preferenceCookie = useCookie<LocalePreference | undefined>(LOCALE_PREFERENCE_KEY, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/'
  })

  let resolved: Locale
  let isManualPreference = false
  if (preferenceCookie.value === 'manual' && isSupportedLocale(localeCookie.value)) {
    isManualPreference = true
    resolved = localeCookie.value
  } else if (import.meta.server) {
    const headers = useRequestHeaders(['accept-language'])
    resolved = resolveLocaleFromAcceptLanguage(headers['accept-language'])
  } else if (isSupportedLocale(localeCookie.value)) {
    // 沿用服务端解析结果（本次会话跟随系统得到），避免水合不一致
    resolved = localeCookie.value
  } else {
    resolved = resolveClientInitialLocale()
  }

  // 渲染前确保词典就绪：中文为静态内置；非兜底语言在此 await 其动态 chunk。
  await loadLocaleMessages(resolved)
  setLocale(resolved, isManualPreference)

  // 由当前语言驱动 <html lang>，服务端渲染即写入，客户端切换语言时响应式更新。
  useHead({ htmlAttrs: { lang: currentLocale } })

  if (import.meta.client) {
    watch(currentLocale, (value) => {
      localeCookie.value = value
    })
  }
})
