import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, ilike, or, ne, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 验证用户登录
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: '未登录'
    })
  }

  const query = getQuery(event)
  const { keyword } = query

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 1) {
    return {
      success: true,
      users: []
    }
  }

  const searchTerm = keyword.trim()

  try {
    // 搜索用户，排除自己
    const results = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        class: users.class,
        grade: users.grade
      })
      .from(users)
      .where(
        and(
          ne(users.id, user.id), // 排除自己
          eq(users.status, 'active'), // 仅搜索活跃用户
          or(ilike(users.name, `%${searchTerm}%`), ilike(users.username, `%${searchTerm}%`))
        )
      )
      .limit(10) // 限制返回数量

    // 模糊处理姓名函数
    const maskName = (name: string) => {
      if (!name) return name
      if (name.length <= 2) return name
      return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
    }

    return {
      success: true,
      users: results.map((u) => ({
        ...u,
        name: maskName(u.name)
      }))
    }
  } catch (error) {
    console.error('搜索用户失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '搜索用户失败'
    })
  }
})
