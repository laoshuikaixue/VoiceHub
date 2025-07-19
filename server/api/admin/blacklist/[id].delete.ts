import { createError, defineEventHandler, getRouterParam } from 'h3'
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

  const id = parseInt(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({
      statusCode: 400,
      message: '无效的ID'
    })
  }

  try {
    // 检查黑名单项是否存在
    const blacklistItem = await prisma.songBlacklist.findUnique({
      where: { id }
    })

    if (!blacklistItem) {
      throw createError({
        statusCode: 404,
        message: '黑名单项不存在'
      })
    }

    // 删除黑名单项
    await prisma.songBlacklist.delete({
      where: { id }
    })

    return {
      success: true,
      message: '黑名单项删除成功'
    }
  } catch (error) {
    if (error.statusCode) {
      throw error
    }
    console.error('删除黑名单项失败:', error)
    throw createError({
      statusCode: 500,
      message: '删除黑名单项失败'
    })
  }
})
