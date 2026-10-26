import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, ne, sql } from 'drizzle-orm'
import { smartSort } from '~~/server/utils/grade-class-core'
import { UNSET_KEY } from '~~/server/utils/recipient-tree'

/**
 * 派发接收人的组织树（年级 → 班级）。
 *
 * 只返回两级维度与人数，不返回用户明细：一所学校上千人，一次性把用户全塞进
 * 下拉会让首屏变慢，也不利于移动端。用户明细由前端在展开某个班级时按
 * grade + class 调 /api/admin/card-codes/recipients 拉取。
 *
 * 未填写年级/班级的用户不会丢：归入 value = UNSET_KEY 的分组，前端展示为
 * 「未设置年级 / 未设置班级」，避免这类账号在派发界面里不可见。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  // 一次聚合查询取出「年级 + 班级」的人数矩阵，避免逐个年级再查一次
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
