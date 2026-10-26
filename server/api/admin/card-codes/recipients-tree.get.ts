import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { ne, sql } from 'drizzle-orm'
import { smartSort } from '~~/server/utils/grade-class-core'
import { UNSET_KEY } from '~~/server/utils/recipient-tree'
import { requireSongAdmin } from '~~/server/utils/requireSongAdmin'

/** 查询接收人组织树，空年级或班级归入 UNSET_KEY。 */
export default defineEventHandler(async (event) => {
  requireSongAdmin(event)

  // 按年级与班级聚合人数
  const rows = await db
    .select({
      grade: users.grade,
      className: users.class,
      userCount: sql<number>`count(*)::int`
    })
    .from(users)
    .where(ne(users.status, 'pending'))
    .groupBy(users.grade, users.class)

  type ClassNode = { value: string; userCount: number }
  type GradeNode = { value: string; userCount: number; classes: ClassNode[] }
  const gradeMap = new Map<string, GradeNode>()

  for (const row of rows) {
    const gradeValue = row.grade && String(row.grade).trim() ? String(row.grade).trim() : UNSET_KEY
    const classValue = row.className && String(row.className).trim()
      ? String(row.className).trim()
      : UNSET_KEY
    const count = Number(row.userCount || 0)

    let gradeNode = gradeMap.get(gradeValue)
    if (!gradeNode) {
      gradeNode = { value: gradeValue, userCount: 0, classes: [] }
      gradeMap.set(gradeValue, gradeNode)
    }
    gradeNode.userCount += count

    let classNode = gradeNode.classes.find((item) => item.value === classValue)
    if (!classNode) {
      classNode = { value: classValue, userCount: 0 }
      gradeNode.classes.push(classNode)
    }
    classNode.userCount += count
  }

  // 年级用学段权重排（初一→高三→大学→教师），「未设置」永远排最后
  const grades = [...gradeMap.values()]
    .map((node) => ({
      ...node,
      classes: [...node.classes].sort((a, b) => {
        if (a.value === UNSET_KEY) return 1
        if (b.value === UNSET_KEY) return -1
        return smartSort(a.value, b.value)
      })
    }))
    .sort((a, b) => {
      if (a.value === UNSET_KEY) return 1
      if (b.value === UNSET_KEY) return -1
      return smartSort(a.value, b.value)
    })

  const total = grades.reduce((sum, node) => sum + node.userCount, 0)

  return {
    success: true,
    total,
    unsetKey: UNSET_KEY,
    grades
  }
})
