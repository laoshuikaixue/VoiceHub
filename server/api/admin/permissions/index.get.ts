import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  try {
    // 获取所有权限，按分类分组
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { displayName: 'asc' }
      ]
    })

    // 按分类分组
    const groupedPermissions = permissions.reduce((acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = []
      }
      acc[permission.category].push(permission)
      return acc
    }, {})

    return {
      permissions: groupedPermissions,
      total: permissions.length
    }
  } catch (error) {
    console.error('获取权限列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取权限列表失败'
    })
  }
})
