// 令牌验证端点
export default defineEventHandler(async (event) => {
  // 认证中间件已经验证了令牌，如果能到这里，说明令牌有效
  const user = event.context.user
  
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未授权访问'
    })
  }
  
  // 返回用户完整信息
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    grade: user.grade,
    class: user.class,
    role: user.role,
    verified: true
  }
})