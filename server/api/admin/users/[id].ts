import { db } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  // 安全获取ID参数
  const params = event.context.params || {}
  const id = parseInt(params.id || '')
  
  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID'
    })
  }

  // 处理PUT请求 - 更新用户
  if (event.method === 'PUT') {
    const body = await readBody(event)
    
    if (!body.name) {
      throw createError({
        statusCode: 400,
        message: '姓名不能为空'
      })
    }
    
    try {
      const updatedUser = await db.user.update({
        where: { id },
        data: {
          name: body.name,
          role: body.role,
          grade: body.grade,
          class: body.class
        },
        select: {
          id: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          grade: true,
          class: true,
          username: true,
          passwordChangedAt: true
        }
      })
      
      return updatedUser
    } catch (error) {
      console.error('更新用户失败:', error)
      throw createError({
        statusCode: 500,
        message: '更新用户失败'
      })
    }
  }
  
  // 处理DELETE请求 - 删除用户
  if (event.method === 'DELETE') {
    try {
      // 确保不能删除自己
      if (id === user.userId) {
        throw createError({
          statusCode: 400,
          message: '不能删除当前登录的用户'
        })
      }
      
      await db.user.delete({
        where: { id }
      })
      
      return { success: true }
    } catch (error) {
      console.error('删除用户失败:', error)
      throw createError({
        statusCode: 500,
        message: '删除用户失败'
      })
    }
  }
  
  throw createError({
    statusCode: 405,
    message: '不支持的请求方法'
  })
})