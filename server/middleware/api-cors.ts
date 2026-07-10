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

  // 解析可信来源：优先使用 NUXT_PUBLIC_HOST，未配置时回退到 Host 头
  const config = useRuntimeConfig(event)
  let configuredHost = config.public?.host

  if (!configuredHost) {
    const hostHeader = getHeader(event, 'host')
    
    if (hostHeader) {
      configuredHost = (hostHeader.split(',')[0] || '').trim()
      
      // 如果 x-forwarded-proto 存在，可以带上协议，使校验更精准
      const forwardedProto = getHeader(event, 'x-forwarded-proto')
      if (forwardedProto && !configuredHost.includes('://')) {
        const proto = (forwardedProto.split(',')[0] || '').trim()
        configuredHost = `${proto}://${configuredHost}`
      }
    } else {
      throw createError({ statusCode: 400, message: 'Bad Request: 缺少Host请求头' })
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
      const normalizeOrigin = (value: string, fallbackProtocol: string) => {
        const normalizedValue = value.includes('://') ? value : `${fallbackProtocol}//${value}`
        const url = new URL(normalizedValue)
        return {
          origin: url.origin,
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? '443' : '80')
        }
      }

      const sourceOrigin = normalizeOrigin(sourceUrl, requestUrl.protocol)
      const trustedOrigin = normalizeOrigin(configuredHost, requestUrl.protocol)
      const isLocalhost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      const isSameLoopbackOrigin =
        isLocalhost(sourceOrigin.hostname) &&
        isLocalhost(trustedOrigin.hostname) &&
        sourceOrigin.protocol === trustedOrigin.protocol &&
        sourceOrigin.port === trustedOrigin.port

      // 额外检查：来源是否与当前请求的 Host 头一致（覆盖域名 / IP 直连场景）
      // Host 头不会被前端 JS 伪造，因此 sourceOrigin.origin === hostOrigin 是有效的第二信任锚点
      const requestHost = getHeader(event, 'host')
      const hostOrigin = getOriginFromHost(requestHost, requestUrl.protocol)
      const matchesRequestHost = hostOrigin && sourceOrigin.origin === hostOrigin

      if (sourceOrigin.origin !== trustedOrigin.origin && !isSameLoopbackOrigin && !matchesRequestHost) {
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

/**
 * 从 Host 头提取 origin
 * 仅使用标准 Host 头（不可被前端 JS 伪造），不信任 X-Forwarded-Host
 */
function getOriginFromHost(hostHeader: string | undefined, defaultProtocol: string): string | null {
  if (!hostHeader) return null
  const firstHost = (hostHeader.split(',')[0] || '').trim()
  try {
    const normalized = firstHost.includes('://') ? firstHost : `${defaultProtocol}//${firstHost}`
    return new URL(normalized).origin
  } catch {
    return null
  }
}

function isTrustedFetchMetadata(
  secFetchSite: string | undefined,
  secFetchMode: string | undefined,
  method: string
): boolean {
  const safeMethod = method === 'GET' || method === 'HEAD'

  if (secFetchSite === 'same-origin') return true

  if (secFetchSite === 'none') {
    const isNavigation = !secFetchMode || secFetchMode === 'navigate'
    return safeMethod && isNavigation
  }

  // 兼容不发送 Fetch Metadata 的老浏览器、WebView 或反向代理；跨站请求有明确标记时仍会被拒绝。
  return !secFetchSite && safeMethod
}
