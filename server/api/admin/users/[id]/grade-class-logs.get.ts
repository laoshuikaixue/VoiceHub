import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { listGradeClassChanges } from '~~/server/utils/grade-class-change'

// 用户班级的变更历史：学生自助修改与管理员代改均在此留痕
export default defineEventHandler(async (event) => {
  try {
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '没有权限访问'
      })
    }

    const userId = getRouterParam(event, 'id')
    const numUserId = Number.parseInt(String(userId), 10)
    if (!Number.isInteger(numUserId) || numUserId <= 0) {
      throw createError({
        statusCode: 400,
        message: '无效的用户 ID'
      })
    }

    const limitNum = Math.min(100, Math.max(1, Number.parseInt(String(getQuery(event).limit ?? '20'), 10) || 20))

    const [targetUser] = await db
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, numUserId))
      .limit(1)

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    const logs = await listGradeClassChanges(numUserId, limitNum)

    return {
      success: true,
      user: targetUser,
      logs: logs.map((log) => ({
        id: log.id,
        semester: log.semester,
        oldGrade: log.oldGrade,
        oldClass: log.oldClass,
        newGrade: log.newGrade,
        newClass: log.newClass,
        source: log.source,
        changedAt: log.changedAt,
        operator: {
          // 操作员已被删除时留空，由前端按"管理员修改"标签展示，禁止在此硬编码中文占位
          name: log.operator.name || log.operator.username,
          username: log.operator.username
        }
      }))
    }
  } catch (error: any) {
    console.error('获取班级变更历史失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '获取班级变更历史失败：' + error.message
    })
  }
})
