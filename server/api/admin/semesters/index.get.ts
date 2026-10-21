import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { desc } from 'drizzle-orm'
import { canManageSemesters } from '~~/server/utils/rbac'

export default defineEventHandler(async (event) => {
  // 权限：semester.manage（SONG_ADMIN 及以上）
  await canManageSemesters(event)

  // 获取所有学期，按创建时间倒序排列
  const semestersList = await db.select().from(semesters).orderBy(desc(semesters.createdAt))

  return semestersList
})
