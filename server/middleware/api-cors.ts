import { getSafeRequestProtocol } from '~~/server/utils/request-utils'

export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event)
  const pathname = requestUrl.pathname
  const requestProtocol = `${getSafeRequestProtocol(event)}:`
  
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
      configuredHost = hostHeader.split(',')[0].trim()
      
      // 如果 x-forwarded-proto 存在，可以带上协议，使校验更精准
      const forwardedProto = getHeader(event, 'x-forwarded-proto')
      if (forwardedProto && !configuredHost.includes('://')) {
        const proto = forwardedProto.split(',')[0].trim()
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

      const sourceOrigin = normalizeOrigin(sourceUrl, requestProtocol)
      const trustedOrigin = normalizeOrigin(configuredHost, requestProtocol)
      const isLocalhost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      const isSameLoopbackOrigin =
        isLocalhost(sourceOrigin.hostname) &&
        isLocalhost(trustedOrigin.hostname) &&
        sourceOrigin.protocol === trustedOrigin.protocol &&
        sourceOrigin.port === trustedOrigin.port

      // 额外检查：来源是否与当前请求的 Host 头一致（覆盖域名 / IP 直连场景）
      // 代理环境可能丢失外部协议，但 Host 头仍能作为当前部署域名的信任锚点。
      const requestHost = getHeader(event, 'host')
      const hostOrigin = getOriginFromHost(requestHost, requestProtocol)
      const matchesRequestHost = hostOrigin && (
        sourceOrigin.origin === hostOrigin.origin ||
        isSameRequestHost(sourceOrigin, hostOrigin)
      )

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
  } else if (secFetchSite === 'same-origin') {
    // 允许没有 Origin/Referer 但明确标记为同源的请求
    return
  } else {
    // 没有来源信息且非 same-origin 上下文 → 拦截（无法区分同站和跨站）
    console.warn(`[CORS Middleware] 拦截无Origin/Referer头的请求: 路径 ${pathname}, sec-fetch-site: ${secFetchSite || 'none'}`)
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
function getOriginFromHost(
  hostHeader: string | undefined,
  defaultProtocol: string
): { origin: string, hostname: string, port: string, protocol: string, hasExplicitPort: boolean } | null {
  if (!hostHeader) return null
  const firstHost = hostHeader.split(',')[0].trim()
  try {
    const normalized = firstHost.includes('://') ? firstHost : `${defaultProtocol}//${firstHost}`
    const url = new URL(normalized)
    return {
      origin: url.origin,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      hasExplicitPort: Boolean(url.port)
    }
  } catch {
    return null
  }
}

function isSameRequestHost(
  sourceOrigin: { hostname: string, port: string },
  hostOrigin: { hostname: string, port: string, hasExplicitPort: boolean }
): boolean {
  if (sourceOrigin.hostname !== hostOrigin.hostname) return false

  if (!hostOrigin.hasExplicitPort) {
    return sourceOrigin.port === '80' || sourceOrigin.port === '443'
  }

  return sourceOrigin.port === hostOrigin.port
}
