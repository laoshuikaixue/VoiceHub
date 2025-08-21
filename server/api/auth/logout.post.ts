export default defineEventHandler(async (event) => {
  try {
    console.log('[Auth] User logout requested')

    // 清除httpOnly cookie
    setCookie(event, 'auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 立即过期
      path: '/'
    })

    return {
      success: true,
      message: '登出成功'
    }
  } catch (error: any) {
    console.error('Logout error:', error)

    // 即使出错也要尝试清除cookie
    try {
      setCookie(event, 'auth-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      })
    } catch (cookieError) {
      console.error('Failed to clear cookie:', cookieError)
    }

    // 在无状态模式下，即使发生错误，也应返回成功，因为客户端的token已被清除
    return {
      success: true,
      message: '登出成功'
    }
  }
})