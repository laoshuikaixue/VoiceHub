import {
  FALLBACK_LOCALE,
  LOCALE_COOKIE_KEY,
  isSupportedLocale,
  loadLocaleMessages,
  resolveClientInitialLocale,
  resolveLocaleFromAcceptLanguage,
  setLocale,
  useLocale,
  type Locale
} from '~/utils/locale'

// 语言初始化插件（服务端 + 客户端通用）。
// - 服务端：按 cookie → Accept-Language 解析语言，确保首屏与用户语言一致（消除中文闪烁 / 修复 SEO 与 <html lang>）。
// - 客户端：从水合状态 / cookie / 本地偏好解析，并保持 cookie 同步。
// 在渲染前 await 目标语言词典，避免懒加载导致的水合不匹配。
export default defineNuxtPlugin(async () => {
  const { currentLocale } = useLocale()
  const localeCookie = useCookie<Locale | undefined>(LOCALE_COOKIE_KEY, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/'
  })

  let resolved: Locale = FALLBACK_LOCALE
  if (isSupportedLocale(localeCookie.value)) {
    resolved = localeCookie.value
  } else if (import.meta.server) {
    const headers = useRequestHeaders(['accept-language'])
    resolved = resolveLocaleFromAcceptLanguage(headers['accept-language'])
  } else {
    resolved = resolveClientInitialLocale()
  }

  // 渲染前确保词典就绪：中文为静态内置；非兜底语言在此 await 其动态 chunk。
  await loadLocaleMessages(resolved)
  setLocale(resolved)
  localeCookie.value = resolved

  // 由当前语言驱动 <html lang>，服务端渲染即写入，客户端切换语言时响应式更新。
  useHead({ htmlAttrs: { lang: currentLocale } })

  if (import.meta.client) {
    watch(currentLocale, (value) => {
      localeCookie.value = value
    })
  }
})
