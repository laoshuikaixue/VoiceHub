export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname
  
  // 只处理特定的内部API路由，防止站外调用
  const isProtectedApi = pathname.startsWith('/api/api-enhanced/netease') || 
                         pathname.startsWith('/api/native-api')
                         
  if (!isProtectedApi) {
    return
  }

  // CORS 限制：禁止站外网站调用
  const origin = getHeader(event, 'origin')
  const referer = getHeader(event, 'referer')
  const secFetchSite = getHeader(event, 'sec-fetch-site')
  const sourceUrl = origin || referer

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl)
      
      // 获取当前请求的 hostname，优先使用配置中可信的主机名，防止 x-forwarded-host 伪造攻击
      const config = useRuntimeConfig(event)
      const configuredHost = config.public?.host as string | undefined
      
      let requestHostname = getRequestURL(event).hostname
      if (configuredHost) {
        // 如果配置了host，提取出hostname部分（可能配置了端口号）
        requestHostname = configuredHost.split(':')[0]
      } else {
        // 只有在未配置公网主机名时，才回退到 host 请求头
        const hostHeader = getHeader(event, 'host') || ''
        if (hostHeader) {
          requestHostname = hostHeader.split(':')[0]
        }
      }
      
      const isLocalhost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
      
      // 如果来源域与当前域不一致，则拒绝请求
      // 注意：允许 localhost 和 127.0.0.1 之间的互访
      if (url.hostname !== requestHostname && !(isLocalhost(url.hostname) && isLocalhost(requestHostname))) {
        console.warn(`[CORS Middleware] 拦截跨域请求: 来源 ${url.hostname}, 期望 ${requestHostname}, 路径 ${pathname}`)
        throw createError({
          statusCode: 403,
          message: 'Forbidden: 内部API不允许跨域请求'
        })
      }
    } catch (e: any) {
      // 如果是我们主动抛出的403错误，则重新抛出
      if (e?.statusCode === 403) {
        throw e
      }
      // 对于其他错误（如无效的URL），这是一个错误的请求
      console.warn(`[CORS Middleware] 无效的来源 URL: ${sourceUrl}`, e)
      throw createError({
        statusCode: 400,
        message: 'Bad Request: Origin或Referer头无效'
      })
    }
  } else if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    // 允许没有 Origin/Referer 但明确标记为同源的请求 (如某些浏览器隐私模式或插件环境)
    return
  } else {
    // 拦截没有来源信息的受保护API请求
    console.warn(`[CORS Middleware] 拦截无Origin/Referer头的请求: 路径 ${pathname}, sec-fetch-site: ${secFetchSite || 'none'}`)
    throw createError({
      statusCode: 403,
      message: 'Forbidden: 访问此API必须提供Origin或Referer头'
    })
  }
})
