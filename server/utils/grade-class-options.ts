import { and, isNotNull, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'

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

export interface GradeClassOption {
  grade: string
  class: string
}

// 从现有 active 用户中提取去重后的年级班级选项（注册表单与 OAuth 注册共用）
export async function fetchGradeClassOptions(): Promise<GradeClassOption[]> {
  const rows = await db
    .selectDistinct({
      grade: users.grade,
      class: users.class
    })
    .from(users)
    .where(and(eq(users.status, 'active'), isNotNull(users.grade), isNotNull(users.class)))

  return rows
    .filter((item): item is { grade: string, class: string } => Boolean(item.grade?.trim()) && Boolean(item.class?.trim()))
    .sort((a, b) => {
      const gradeResult = smartSort(a.grade, b.grade)
      return gradeResult || smartSort(a.class, b.class)
    })
}