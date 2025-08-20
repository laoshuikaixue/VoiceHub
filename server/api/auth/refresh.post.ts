import { JWTEnhanced } from '../../utils/jwt-enhanced'

export default defineEventHandler(async (event) => {
  try {
    // 从cookie获取refresh token
    const refreshToken = getCookie(event, 'refresh-token')
    
    if (!refreshToken) {
      throw createError({
        statusCode: 401,
        message: 'Refresh token不存在'
      })
    }
    
    // 获取用户代理信息
    const userAgent = getRequestHeader(event, 'user-agent') || 'Unknown'
    
    try {
      // 刷新access token
      const newTokenPair = JWTEnhanced.refreshAccessToken(refreshToken, userAgent)
      
      // 设置新的access token cookie
      setCookie(event, 'auth-token', newTokenPair.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15分钟
        path: '/'
      })
      
      // 如果有新的refresh token，也要更新
      if (newTokenPair.refreshToken) {
        setCookie(event, 'refresh-token', newTokenPair.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7天
          path: '/'
        })
      }
      
      return {
        success: true,
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
        sessionId: newTokenPair.sessionId,
        expiresIn: 15 * 60, // access token过期时间（秒）
        message: 'Token刷新成功'
      }
      
    } catch (refreshError: any) {
      // Token刷新失败，清除所有cookies
      deleteCookie(event, 'auth-token')
      deleteCookie(event, 'refresh-token')
      
      throw createError({
        statusCode: 401,
        message: refreshError.message || 'Token刷新失败，请重新登录'
      })
    }
    
  } catch (error: any) {
    console.error('Token refresh error:', error)
    
    // 如果是已知的认证错误，直接抛出
    if (error.statusCode) {
      throw error
    }
    
    // 未知错误
    throw createError({
      statusCode: 500,
      message: '服务器内部错误'
    })
  }
})