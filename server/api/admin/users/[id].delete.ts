import { createError, defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证和权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '没有权限访问'
      })
    }

    const userId = getRouterParam(event, 'id')

    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    })

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        statusMessage: '用户不存在'
      })
    }

    // 防止删除自己
    if (existingUser.id === user.id) {
      throw createError({
        statusCode: 400,
        statusMessage: '不能删除自己的账户'
      })
    }

    // 删除用户
    await prisma.user.delete({
      where: { id: parseInt(userId) }
    })

    return {
      success: true,
      message: '用户删除成功'
    }
  } catch (error) {
    console.error('删除用户失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '删除用户失败: ' + error.message
    })
  }
})
