export default defineEventHandler(async (event) => {
  try {
    console.log('[Auth] User logout requested')

    // 获取当前用户信息（如果存在）
    const user = event.context.user

    // 清除用户认证缓存
    if (user) {
      try {
        const { cache } = await import('~~/server/utils/cache-helpers')
        await cache.delete(`auth:user:${user.id}`)
        console.log(`[Cache] 用户认证缓存已清除（用户登出）: ${user.id}`)
      } catch (cacheError) {
        console.warn('[Cache] 清除用户认证缓存失败:', cacheError)
      }
    }

    // 清除cookie
    const isSecure =
      getRequestURL(event).protocol === 'https:' ||
      getRequestHeader(event, 'x-forwarded-proto') === 'https'
    setCookie(event, 'auth-token', '', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })

    return {
      success: true,
      message: '登出成功'
    }
  } catch (error: any) {
    console.error('Logout error:', error)

    // 出错时也要清除cookie
    try {
      setCookie(event, 'auth-token', '', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      })
    } catch (cookieError) {
      console.error('Failed to clear cookie:', cookieError)
    }

    // 返回成功状态
    return {
      success: true,
      message: '登出成功'
    }
  }
})
