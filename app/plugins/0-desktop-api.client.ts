import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(async (nuxtApp) => {
  // 仅在客户端且为Electron环境时运行
  if (!import.meta.client || !window.electron) {
    return
  }

  const { getApiUrl } = window.electron
  let apiBaseUrl = ''
  
  try {
    apiBaseUrl = await getApiUrl()
    console.log('[Desktop] Loaded API URL:', apiBaseUrl)
  } catch (e) {
    console.error('[Desktop] Failed to load API URL:', e)
  }

  // 辅助函数：修复URL
  const fixUrl = (url: string) => {
    // 只有当URL以/api开头，且我们有base URL时才修改
    if (typeof url === 'string' && url.startsWith('/api') && apiBaseUrl) {
      // 移除base URL末尾的斜杠（如果有）
      const base = apiBaseUrl.replace(/\/$/, '')
      // 确保path以斜杠开头
      const path = url.startsWith('/') ? url : `/${url}`
      return `${base}${path}`
    }
    return url
  }

  // 拦截 window.fetch
  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      input = fixUrl(input)
    }
    return originalFetch(input, init)
  }

  // 拦截 $fetch
  // 使用 app:created 钩子确保在其他插件之后（或之前，取决于文件名顺序）运行
  // 我们希望在 auth 插件之前运行（文件名 0-desktop-api.client.ts vs auth.client.ts）
  // 这样 auth 插件包裹的是我们的 desktop wrapper
  // 调用顺序：Auth Wrapper -> Desktop Wrapper -> Original
  nuxtApp.hook('app:created', () => {
    const originalUseFetch = nuxtApp.$fetch
    nuxtApp.$fetch = async function (request: any, options: any = {}) {
      if (typeof request === 'string' && request.startsWith('/api')) {
        request = fixUrl(request)
      }
      return originalUseFetch(request, options)
    } as any
  })

  // 提供一个方法来更新 API URL（用于设置页面保存后立即生效）
  return {
    provide: {
      updateDesktopApiUrl: (url: string) => {
        apiBaseUrl = url
        console.log('[Desktop] Updated API URL:', apiBaseUrl)
      }
    }
  }
})
