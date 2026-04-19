import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { isNotNull } from 'drizzle-orm'

// 智能排序函数
const smartSort = (a: string, b: string) => {
  const gradeOrder: Record<string, number> = {
    '初一': 1, '初二': 2, '初三': 3,
    '高一': 4, '高二': 5, '高三': 6,
    '大一': 7, '大二': 8, '大三': 9, '大四': 10,
    '教师': 99, '教职工': 99
  }

  const weightA = gradeOrder[a]
  const weightB = gradeOrder[b]

  if (weightA !== undefined && weightB !== undefined) return weightA - weightB
  if (weightA !== undefined) return -1
  if (weightB !== undefined) return 1

  return a.localeCompare(b, 'zh-CN', { numeric: true })
}

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
    // 获取有年级的用户（用 distinct 去重）
    const gradesData = await db
      .selectDistinct({ grade: users.grade })
      .from(users)
      .where(isNotNull(users.grade))
    
    // 获取有班级的用户（用 distinct 去重）
    const classesData = await db
      .selectDistinct({ grade: users.grade, class: users.class })
      .from(users)
      .where(isNotNull(users.class))

    // 提取为简单的数组格式并按自然顺序排序
    const grades = gradesData
      .map(g => g.grade)
      .filter((g): g is string => Boolean(g))
      .sort(smartSort)

    const classes = classesData
      .filter(c => Boolean(c.class))
      .map(c => ({
        grade: c.grade,
        class: c.class as string
      }))
      // 预先排好序，这里使用智能排序，以防班级中也混有复杂的文字逻辑
      .sort((a, b) => smartSort(a.class, b.class))

    return {
      success: true,
      grades,
      classes
    }
  } catch (error) {
    console.error('获取用户筛选选项失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取选项失败'
    })
  }
})