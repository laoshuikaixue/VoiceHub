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
  const sourceUrl = origin || referer

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl)
      // 获取当前请求的 host（h3 的 getRequestHost 会自动处理 x-forwarded-host）
      let requestHost = getRequestHost(event)
      // 移除可能存在的默认端口，以确保与 url.host 匹配
      requestHost = requestHost.replace(/:80$/, '').replace(/:443$/, '')
      
      // 如果来源域与当前域不一致，则拒绝请求
      if (url.host !== requestHost) {
        console.warn(`[CORS Middleware] 拦截跨域请求: 来源 ${url.host}, 期望 ${requestHost}, 路径 ${pathname}`)
        throw createError({
          statusCode: 403,
          message: 'Forbidden: Cross-origin requests are not allowed for this internal API'
        })
      }
    } catch (e: any) {
      // 已被抛出的 403 错误
      if (e?.statusCode === 403) throw e
    }
  }
})
