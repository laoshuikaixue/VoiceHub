import { defineEventHandler, createError } from 'h3'
import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '需要登录'
    })
  }

  const list = await db
    .select({
      id: semesters.id,
      name: semesters.name,
      isActive: semesters.isActive
    })
    .from(semesters)
    .orderBy(desc(semesters.createdAt))

  return {
    success: true,
    data: list
  }
})
