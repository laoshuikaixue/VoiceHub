import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../models/schema'

export default defineEventHandler(async (event) => {
  try {
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        lastLogin: true,
        lastLoginIp: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        id: 'asc'
      }
    })

    return {
      success: true,
      users
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '获取用户列表失败: ' + error.message
    })
  }
})
