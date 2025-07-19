import { createError, defineEventHandler, getRouterParam } from 'h3'
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

  try {
    // 获取用户信息
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true
      }
    })

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 获取用户的角色权限
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { 
        role: targetUser.role,
        granted: true
      },
      include: {
        permission: true
      }
    })

    // 获取用户的个人权限
    const userPermissions = await prisma.userPermission.findMany({
      where: { userId: userId },
      include: {
        permission: true
      }
    })

    // 合并权限
    const allPermissions = await prisma.permission.findMany()
    const userPermissionMap = {}

    // 先设置角色权限
    rolePermissions.forEach(rp => {
      userPermissionMap[rp.permission.name] = {
        ...rp.permission,
        granted: rp.granted,
        source: 'role'
      }
    })

    // 再设置个人权限（覆盖角色权限）
    userPermissions.forEach(up => {
      userPermissionMap[up.permission.name] = {
        ...up.permission,
        granted: up.granted,
        source: 'user'
      }
    })

    // 补充未设置的权限
    allPermissions.forEach(permission => {
      if (!userPermissionMap[permission.name]) {
        userPermissionMap[permission.name] = {
          ...permission,
          granted: false,
          source: 'none'
        }
      }
    })

    return {
      user: targetUser,
      permissions: Object.values(userPermissionMap)
    }
  } catch (error) {
    console.error('获取用户权限失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取用户权限失败'
    })
  }
})
