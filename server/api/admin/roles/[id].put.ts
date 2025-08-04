import { prisma } from '~/server/models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 验证超级管理员权限
    const user = event.context.user
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        statusMessage: '只有超级管理员可以编辑角色'
      })
    }

    const roleId = parseInt(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const { name, description, permissions } = body

    if (!name) {
      throw createError({
        statusCode: 400,
        statusMessage: '角色名称不能为空'
      })
    }

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    })

    if (!existingRole) {
      throw createError({
        statusCode: 404,
        statusMessage: '角色不存在'
      })
    }

    // 检查是否为系统角色
    if (existingRole.isSystem) {
      throw createError({
        statusCode: 400,
        statusMessage: '系统角色不能修改'
      })
    }

    // 检查角色名称是否与其他角色冲突
    const nameConflict = await prisma.role.findFirst({
      where: {
        name,
        id: { not: roleId }
      }
    })

    if (nameConflict) {
      throw createError({
        statusCode: 400,
        statusMessage: '角色名称已存在'
      })
    }

    // 更新角色信息
    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        name,
        description: description || null,
        permissions: permissions || []
      }
    })

    // 获取用户数量
    const userCount = await prisma.user.count({
      where: { role: updatedRole.name }
    })

    return {
      success: true,
      role: {
        id: updatedRole.id,
        name: updatedRole.name,
        displayName: updatedRole.displayName,
        description: updatedRole.description,
        isSystem: updatedRole.isSystem,
        permissions: updatedRole.permissions,
        userCount: userCount
      }
    }
  } catch (error) {
    console.error('更新角色失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '更新角色失败'
    })
  }
})
