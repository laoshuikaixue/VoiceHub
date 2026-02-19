import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  try {
    // 获取所有用户
    const usersList = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        grade: users.grade,
        class: users.class,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        passwordChangedAt: users.passwordChangedAt
      })
      .from(users)
      .orderBy(asc(users.id))

    return usersList
  } catch (error) {
    console.error('获取用户列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取用户列表失败'
    })
  }
})
