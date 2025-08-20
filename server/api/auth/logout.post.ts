import { JWTEnhanced } from '../../utils/jwt-enhanced'

export default defineEventHandler(async (event) => {
  try {
    // 获取tokens
    const accessToken = getCookie(event, 'auth-token')
    const refreshToken = getCookie(event, 'refresh-token')
    
    // 撤销tokens（加入黑名单）
    if (accessToken) {
      try {
        JWTEnhanced.revokeToken(accessToken)
        console.log('Access token revoked successfully')
      } catch (error) {
        console.warn('Failed to revoke access token:', error)
      }
    }
    
    if (refreshToken) {
      try {
        JWTEnhanced.revokeToken(refreshToken)
        console.log('Refresh token revoked successfully')
      } catch (error) {
        console.warn('Failed to revoke refresh token:', error)
      }
    }
    
    // 删除认证cookies
    deleteCookie(event, 'auth-token')
    deleteCookie(event, 'refresh-token')
    
    return {
      success: true,
      message: '登出成功'
    }
    
  } catch (error: any) {
    console.error('Logout error:', error)
    
    // 即使出错也要删除cookies
    deleteCookie(event, 'auth-token')
    deleteCookie(event, 'refresh-token')
    
    return {
      success: true,
      message: '登出成功'
    }
  }
})