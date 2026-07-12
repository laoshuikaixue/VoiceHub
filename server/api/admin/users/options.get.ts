import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'

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

    const gradesSet = new Set<string>()
    const classesMap = new Map<string, { grade: string | null, class: string }>()

    for (const treeUser of treeUsers) {
      const gradeValue = treeUser.grade?.trim() || ''
      const classValue = treeUser.class?.trim() || ''

      if (gradeValue) {
        gradesSet.add(gradeValue)
      }

      if (classValue) {
        const classKey = `${gradeValue}:${classValue}`
        if (!classesMap.has(classKey)) {
          classesMap.set(classKey, {
            grade: gradeValue || null,
            class: classValue
          })
        }
      }
    }

    const grades = Array.from(gradesSet).sort(smartSort)
    const classes = Array.from(classesMap.values()).sort((a, b) =>
      a.class.localeCompare(b.class, 'zh-CN', { numeric: true })
    )

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
