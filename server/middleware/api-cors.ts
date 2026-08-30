import { isTrustedOrigin, normalizeOrigin } from '~~/server/utils/request-utils'

export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event)
  const pathname = requestUrl.pathname
  const method = getMethod(event)
  
  // 只处理特定的内部API路由，防止站外调用
  const isProtectedApi = pathname.startsWith('/api/api-enhanced/netease') || 
                         pathname.startsWith('/api/native-api')

  if (!isProtectedApi) {
    return
  }

  // 内部受信客户端绕过 CORS 校验
  const requestedFrom = getHeader(event, 'x-requested-from')
  if (requestedFrom === 'ClassIslandPlugin') {
    return
  }

  // 显式配置 NUXT_PUBLIC_HOST 时使用配置来源校验。
  // 未配置时仍使用 Host 头；云平台等公开 Host 继续校验，仅当反向代理把 Host 改写为回环地址时跳过。
  const config = useRuntimeConfig(event)
  let configuredHost = typeof config.public?.host === 'string' ? config.public.host.trim() : ''

  if (!configuredHost) {
    const hostHeader = getHeader(event, 'host')
    if (!hostHeader) {
      throw createError({ statusCode: 400, message: 'Bad Request: 缺少Host请求头' })
    }

    configuredHost = (hostHeader.split(',')[0] || '').trim()

    try {
      const hostOrigin = normalizeOrigin(configuredHost, requestUrl.protocol)
      if (isLoopbackHostname(hostOrigin.hostname)) {
        return
      }
    } catch {
      throw createError({ statusCode: 400, message: 'Bad Request: Host请求头无效' })
    }

    // 如果 x-forwarded-proto 存在，可以带上协议，使校验更精准
    const forwardedProto = getHeader(event, 'x-forwarded-proto')
    if (forwardedProto && !configuredHost.includes('://')) {
      const proto = (forwardedProto.split(',')[0] || '').trim()
      configuredHost = `${proto}://${configuredHost}`
    }
  }

  // CORS 限制：禁止站外网站调用
  const origin = getHeader(event, 'origin')
  const referer = getHeader(event, 'referer')
  const secFetchSite = getHeader(event, 'sec-fetch-site')
  const secFetchMode = getHeader(event, 'sec-fetch-mode')
  const sourceUrl = origin || referer

  if (sourceUrl) {
    try {
      const sourceOrigin = normalizeOrigin(sourceUrl, requestUrl.protocol)
      const trustedOrigin = normalizeOrigin(configuredHost, requestUrl.protocol)
      const isSameLoopbackOrigin =
        isLoopbackHostname(sourceOrigin.hostname) &&
        isLoopbackHostname(trustedOrigin.hostname) &&
        sourceOrigin.protocol === trustedOrigin.protocol &&
        sourceOrigin.port === trustedOrigin.port

      const matchesConfiguredOrigin = isTrustedOrigin(sourceOrigin, trustedOrigin)

      if (!matchesConfiguredOrigin && !isSameLoopbackOrigin) {
        console.warn(`[CORS Middleware] 拦截跨域请求: 来源 ${sourceOrigin.origin}, 期望 ${trustedOrigin.origin}, 路径 ${pathname}`)
        throw createError({
          statusCode: 403,
          message: 'Forbidden: 内部API不允许跨域请求'
        })
      }
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'statusCode' in e &&
        typeof e.statusCode === 'number'
      ) {
        throw e
      }
      console.warn(`[CORS Middleware] 无效的来源 URL: ${sourceUrl}`, e)
      throw createError({
        statusCode: 400,
        message: 'Bad Request: Origin或Referer头无效'
      })
    }
  } else if (isTrustedFetchMetadata(secFetchSite, secFetchMode, method)) {
    // 浏览器隐私策略可能移除来源头，此时 Fetch Metadata 是更稳定的同源信号。
    return
  } else {
    // 没有来源信息且缺少可信 Fetch Metadata 时，仍按站外请求处理。
    console.warn(`[CORS Middleware] 拦截无Origin/Referer头的请求: 路径 ${pathname}, sec-fetch-site: ${secFetchSite || 'missing'}`)
    throw createError({
      statusCode: 403,
      message: 'Forbidden: 访问此API必须提供Origin或Referer头'
    })
  }
})

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

function isTrustedFetchMetadata(
  secFetchSite: string | undefined,
  secFetchMode: string | undefined,
  method: string
): boolean {
  const normalizedMethod = method.toUpperCase()
  const safeMethod = normalizedMethod === 'GET' || normalizedMethod === 'HEAD'

  if (secFetchSite === 'same-origin') return true

  if (secFetchSite === 'none') {
    const isNavigation = !secFetchMode || secFetchMode === 'navigate'
    return safeMethod && isNavigation
  }

  // 兼容不发送 Fetch Metadata 的老浏览器、WebView 或反向代理；跨站请求有明确标记时仍会被拒绝。
  return !secFetchSite && safeMethod
}
