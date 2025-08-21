export default defineEventHandler(async (event) => {
  try {
    console.log('[Auth] User logout requested')

    // 清除cookie
    setCookie(event, 'auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
        secure: process.env.NODE_ENV === 'production',
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