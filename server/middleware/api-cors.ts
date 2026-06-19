export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event)
  const pathname = requestUrl.pathname
  
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

  // 检查是否配置了 NUXT_PUBLIC_HOST，若未配置，则尝试从请求头中获取可信的 Host。
  // 在反代环境下，为了保证即使没有 NUXT_PUBLIC_HOST 也能工作，
  // 优先取 x-forwarded-host，其次取 host，作为我们回退校验的信任基准。
  const config = useRuntimeConfig(event)
  let configuredHost = config.public?.host

  if (!configuredHost) {
    const forwardedHost = getHeader(event, 'x-forwarded-host')
    const hostHeader = getHeader(event, 'host')
    const fallbackHost = forwardedHost || hostHeader
    
    if (fallbackHost) {
      // 兼容多代理环境，取第一个 host
      configuredHost = fallbackHost.split(',')[0].trim()
      
      // 如果 x-forwarded-proto 存在，可以带上协议，使校验更精准
      const forwardedProto = getHeader(event, 'x-forwarded-proto')
      if (forwardedProto && !configuredHost.includes('://')) {
        const proto = forwardedProto.split(',')[0].trim()
        configuredHost = `${proto}://${configuredHost}`
      }
    } else {
      // 如果什么 host 都拿不到，拒绝请求以保证安全
      throw createError({ statusCode: 400, message: 'Bad Request: 缺少Host请求头' })
    }
  }

  // CORS 限制：禁止站外网站调用
  const origin = getHeader(event, 'origin')
  const referer = getHeader(event, 'referer')
  const secFetchSite = getHeader(event, 'sec-fetch-site')
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

      // 检查来源是否与当前请求的 Host 头一致（覆盖域名、IP 直连场景）
      // 此处仅取 host 头，避免 X-Forwarded-Host 可被前端伪造
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
      // 如果是我们主动抛出的 HTTP 错误，则重新抛出
      if (
        typeof e === 'object' &&
        e !== null &&
        'statusCode' in e &&
        typeof e.statusCode === 'number'
      ) {
        throw e
      }
      // 对于其他错误（如无效的URL），这是一个错误的请求
      console.warn(`[CORS Middleware] 无效的来源 URL: ${sourceUrl}`, e)
      throw createError({
        statusCode: 400,
        message: 'Bad Request: Origin或Referer头无效'
      })
    }
  } else if (secFetchSite === 'same-origin') {
    // 允许没有 Origin/Referer 但明确标记为同源的请求
    return
  } else {
    // 没有 Origin/Referer —— 检查 Host 头是否等于可信来源
    // 注意：Host 头不能被前端 JS 伪造，可以安全用于放行
    const requestHost = getHeader(event, 'host')
    const hostOrigin = getOriginFromHost(requestHost, requestUrl.protocol)
    if (hostOrigin && hostOrigin === trustedOrigin.origin) {
      return
    }

    // 仍然没有来源信息 → 拦截
    console.warn(`[CORS Middleware] 拦截无Origin/Referer头的请求: 路径 ${pathname}, sec-fetch-site: ${secFetchSite || 'none'}`)
    throw createError({
      statusCode: 403,
      message: 'Forbidden: 访问此API必须提供Origin或Referer头'
    })
  }
})

/**
 * 从 Host 头提取 origin，只使用标准 Host 头（不可被前端 JS 伪造）
 * @param hostHeader Host 请求头的值
 * @param defaultProtocol 默认协议
 * @returns origin 字符串，解析失败时返回 null
 */
function getOriginFromHost(hostHeader: string | undefined, defaultProtocol: string): string | null {
  if (!hostHeader) return null
  const firstHost = hostHeader.split(',')[0].trim()
  try {
    const normalized = firstHost.includes('://') ? firstHost : `${defaultProtocol}//${firstHost}`
    return new URL(normalized).origin
  } catch {
    return null
  }
}
