import { and, isNotNull, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { verifyBindingToken } from '~~/server/utils/oauth-token'

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
  const config = await db.query.systemSettings.findFirst()
  if (!config?.allowOAuthRegistration) {
    throw createError({ statusCode: 403, message: '系统已关闭第三方账号注册功能' })
  }

  const bindingToken = getCookie(event, 'binding-token')
  if (!bindingToken) {
    throw createError({ statusCode: 401, message: '注册会话已过期，请重新通过第三方登录发起' })
  }

  try {
    verifyBindingToken(bindingToken)
  } catch {
    deleteCookie(event, 'binding-token')
    throw createError({ statusCode: 401, message: '无效的注册令牌' })
  }

  const rows = await db
    .selectDistinct({
      grade: users.grade,
      class: users.class
    })
    .from(users)
    .where(and(eq(users.status, 'active'), isNotNull(users.grade), isNotNull(users.class)))

  const classes = rows
    .filter((item): item is { grade: string, class: string } => Boolean(item.grade?.trim()) && Boolean(item.class?.trim()))
    .sort((a, b) => {
      const gradeResult = smartSort(a.grade, b.grade)
      return gradeResult || smartSort(a.class, b.class)
    })

  return {
    success: true,
    classes
  }
})
