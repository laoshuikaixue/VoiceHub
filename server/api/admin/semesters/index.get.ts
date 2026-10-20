import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { desc } from 'drizzle-orm'
import { requireAdminAccess } from '~~/server/utils/requireAdminPermission'

export default defineEventHandler(async (event) => {
  requireAdminAccess(event)

  // 获取所有学期，按创建时间倒序排列
  const semestersList = await db.select().from(semesters).orderBy(desc(semesters.createdAt))

  return semestersList
})
