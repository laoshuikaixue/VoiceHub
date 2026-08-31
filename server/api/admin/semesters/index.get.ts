import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { desc } from 'drizzle-orm'
import { requirePermission } from '~~/server/utils/rbac/guards'
import { PERMISSIONS } from '~~/server/utils/rbac/constants'

export default defineEventHandler(async (event) => {
  const _user = await requirePermission(event, PERMISSIONS.SEMESTER_MANAGE)

  // 获取所有学期，按创建时间倒序排列
  const semestersList = await db.select().from(semesters).orderBy(desc(semesters.createdAt))

  return semestersList
})
