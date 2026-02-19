import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 检查用户认证和权限
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录才能访问'
    })
  }

  if (!['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '只有管理员才能管理学期'
    })
  }

  // 获取所有学期，按创建时间倒序排列
  const semestersList = await db.select().from(semesters).orderBy(desc(semesters.createdAt))

  return semestersList
})
