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
  
  // 返回用户基本信息，不包含敏感数据
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    verified: true
  }
}) 