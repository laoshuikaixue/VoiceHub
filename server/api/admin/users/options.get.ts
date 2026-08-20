import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { fetchGradeClassOptions } from '~~/server/utils/grade-class-options'
import { smartSort } from '~~/server/utils/grade-class-core'

export default defineEventHandler(async (event) => {
  try {
    // 检查用户是否为管理员
    const user = event.context.user

    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '只有系统管理员可以访问此选项'
      })
    }
    // 用户树需要全量轻字段，避免用分页列表推导时统计不完整
    const treeUsers = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        grade: users.grade,
        class: users.class,
        role: users.role,
        status: users.status
      })
      .from(users)

    // 年级班级选项：配置优先，未配置时回退到用户提取（组织结构树不受影响，始终基于真实用户）
    const options = await fetchGradeClassOptions()
    const grades = [...new Set(options.map((item) => item.grade))].sort(smartSort)
    const classes = options.map((item) => ({ grade: item.grade, class: item.class }))

    return {
      success: true,
      grades,
      classes,
      treeUsers
    }
  } catch (error) {
    console.error('获取用户筛选选项失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取选项失败'
    })
  }
})