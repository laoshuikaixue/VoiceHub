export default defineEventHandler(async (event) => {
  try {
    // 在JWT-only模式下，登出主要由客户端处理
    // 服务端只需要返回成功响应
    console.log('[Auth] User logout requested')
    
    return {
      success: true,
      message: '登出成功'
    }
    
  } catch (error: any) {
    console.error('Logout error:', error)
    
    // 即使出错也返回成功，因为JWT是无状态的
    return {
      success: true,
      message: '登出成功'
    }
  }
})