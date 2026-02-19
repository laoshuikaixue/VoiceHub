export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) {
    return
  }

  // 立即设置请求拦截器，确保在任何API调用之前生效
  const originalFetch = window.fetch
  const errorHandler = useErrorHandler()

  // 拦截window.fetch
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // 处理所有API请求 - cookie会自动发送，无需手动添加Authorization头
    if (typeof input === 'string' && input.startsWith('/api')) {
      init = init || {}
      init.headers = init.headers || {}

      // 确保cookie会被发送
      init.credentials = 'include'
    }

    const response = await originalFetch(input, init)

    // 检查是否为401错误
    if (response.status === 401) {
      const currentPath = window.location.pathname

      // 如果在登录页面，解析错误响应体并抛出具体错误信息
      if (currentPath === '/login') {
        try {
          const errorData = await response.clone().json()
          const errorMessage = errorData.message || '登录失败，请检查账号密码'
          return Promise.reject(new Error(errorMessage))
        } catch (parseError) {
          return Promise.reject(new Error('登录失败，请检查账号密码'))
        }
      }

      // 只有在非登录页面才触发认证失效处理
      await errorHandler.handle401Error('您的登录信息已失效，请重新登录')
      return Promise.reject(new Error('Authentication expired'))
    }

    return response
  }

  // 初始化认证状态
  nuxtApp.hook('app:created', async () => {
    const auth = useAuth()
    await auth.initAuth()

    // 拦截$fetch请求，确保cookie会被发送
    const originalUseFetch = nuxtApp.$fetch
    if (originalUseFetch) {
      nuxtApp.$fetch = async function (request: any, options: any = {}) {
        // 为所有API请求确保cookie会被发送
        if (typeof request === 'string' && request.startsWith('/api')) {
          options.headers = options.headers || {}
          // 确保cookie会被发送
          options.credentials = 'include'
        }

        try {
          return await originalUseFetch(request, options)
        } catch (error: any) {
          // 检查是否为401错误
          if (error?.status === 401 || error?.statusCode === 401) {
            const currentPath = window.location.pathname

            // 如果在登录页面，解析错误信息并抛出具体错误
            if (currentPath === '/login') {
              // 从error对象中提取具体错误信息，过滤掉网络请求信息
              let errorMessage =
                error?.data?.message || error?.message || '登录失败，请检查账号密码'

              // 如果错误信息包含网络请求格式（如 [POST] "/api/auth/login": <no response>），则提取纯净的错误信息
              if (typeof errorMessage === 'string') {
                // 匹配并移除网络请求前缀格式
                const cleanMessage = errorMessage
                  .replace(/^\[\w+\]\s+"[^"]+":\s+(<no response>\s+)?/, '')
                  .trim()
                errorMessage = cleanMessage || '登录失败，请检查账号密码'
              }

              const newError = new Error(errorMessage)
              throw newError
            }

            // 只有在非登录页面才触发认证失效处理
            await errorHandler.handle401Error('您的登录信息已失效，请重新登录')
            throw error
          }
          throw error
        }
      }
    }
  })

  // 全局错误处理
  nuxtApp.hook('vue:error', async (error: any) => {
    if (error?.status === 401 || error?.statusCode === 401) {
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        await errorHandler.handle401Error('您的登录信息已失效，请重新登录')
      }
    }
  })
})
