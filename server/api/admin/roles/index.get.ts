import { prisma } from '~/server/models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 获取所有角色
    const roles = await prisma.role.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    })

    // 获取每个角色的用户数量
    const rolesWithUserCount = await Promise.all(
      roles.map(async (role) => {
        const userCount = await prisma.user.count({
          where: { role: role.name }
        })

        return {
          ...role,
          userCount
        }
      })
    )

    return {
      success: true,
      roles: rolesWithUserCount
    }
  } catch (error) {
    console.error('获取角色列表失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '获取角色列表失败: ' + error.message
    })
  }
})
