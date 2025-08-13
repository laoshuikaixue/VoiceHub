export default defineEventHandler(async (event) => {
  // 清除认证cookie
  deleteCookie(event, 'auth-token', {
    path: '/'
  })
  
  return {
    success: true,
    message: '登出成功'
  }
})