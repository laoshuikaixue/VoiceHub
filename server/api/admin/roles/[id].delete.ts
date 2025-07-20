import { prisma } from '~/server/models/schema'

export default defineEventHandler(async (event) => {
  try {
    const roleId = parseInt(getRouterParam(event, 'id'))

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
        statusMessage: '系统角色不能删除'
      })
    }

    // 检查是否有用户使用该角色
    const userCount = await prisma.user.count({
      where: { role: existingRole.name }
    })

    if (userCount > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '该角色下还有用户，无法删除'
      })
    }

    // 删除角色
    await prisma.role.delete({
      where: { id: roleId }
    })

    return {
      success: true,
      message: '角色删除成功'
    }
  } catch (error) {
    console.error('删除角色失败:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '删除角色失败'
    })
  }
})
