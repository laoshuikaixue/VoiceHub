import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const userId = parseInt(getRouterParam(event, 'userId'))
  if (!userId) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID'
    })
  }

  const body = await readBody(event)
  const { permissions } = body

  if (!Array.isArray(permissions)) {
    throw createError({
      statusCode: 400,
      message: '权限数据格式错误'
    })
  }

  try {
    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 删除现有的用户权限
    await prisma.userPermission.deleteMany({
      where: { userId: userId }
    })

    // 创建新的用户权限
    const userPermissions = []
    for (const perm of permissions) {
      if (perm.source === 'user') {
        const permission = await prisma.permission.findUnique({
          where: { name: perm.name }
        })

        if (permission) {
          userPermissions.push({
            userId: userId,
            permissionId: permission.id,
            granted: perm.granted
          })
        }
      }
    }

    if (userPermissions.length > 0) {
      await prisma.userPermission.createMany({
        data: userPermissions
      })
    }

    return {
      success: true,
      message: '用户权限更新成功',
      updatedPermissions: userPermissions.length
    }
  } catch (error) {
    console.error('更新用户权限失败:', error)
    throw createError({
      statusCode: 500,
      message: '更新用户权限失败'
    })
  }
})
