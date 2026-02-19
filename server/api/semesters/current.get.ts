import { db } from '~/drizzle/db'
import { semesters } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 获取当前活跃的学期
    const currentSemesterResult = await db
      .select()
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1)
    const currentSemester = currentSemesterResult[0]

    if (!currentSemester) {
      // 如果没有活跃学期，返回错误信息或空状态
      return {
        name: null,
        message: '未设置活跃学期'
      }
    }

    return currentSemester
  } catch (error: any) {
    console.error('获取当前学期失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取当前学期失败'
    })
  }
})
