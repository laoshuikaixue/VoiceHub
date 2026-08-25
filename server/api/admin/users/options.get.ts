import { createError, defineEventHandler } from 'h3'
import { db } from '~/drizzle/db'
import { users, gradeClass } from '~/drizzle/schema'
import { ne } from 'drizzle-orm'
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
    // 用户树需要全量轻字段，避免用分页列表推导时统计不完整；排除待审核用户（未通过审核不计入组织树/筛选）
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
      .where(ne(users.status, 'pending'))

    // 年级班级选项：配置优先；未配置时回退到全部用户聚合（含 withdrawn/graduate 与仅有班级项），
    // 与组织结构树口径一致，避免筛选下拉缺项
    const configRows = await db
      .select({ grade: gradeClass.grade, class: gradeClass.class })
      .from(gradeClass)

    let grades: string[]
    let classes: { grade: string | null; class: string }[]
    if (configRows.length > 0) {
      const options = configRows
        .filter((item) => Boolean(item.grade?.trim()) && Boolean(item.class?.trim()))
        .sort((a, b) => {
          const gradeResult = smartSort(a.grade, b.grade)
          return gradeResult || smartSort(a.class, b.class)
        })
      grades = [...new Set(options.map((item) => item.grade))].sort(smartSort)
      classes = options.map((item) => ({ grade: item.grade, class: item.class }))
    } else {
      const gradesSet = new Set<string>()
      const classesMap = new Map<string, { grade: string | null; class: string }>()
      for (const treeUser of treeUsers) {
        const gradeValue = treeUser.grade?.trim() || ''
        const classValue = treeUser.class?.trim() || ''
        if (gradeValue) gradesSet.add(gradeValue)
        if (classValue) {
          const classKey = `${gradeValue}:${classValue}`
          if (!classesMap.has(classKey)) {
            classesMap.set(classKey, { grade: gradeValue || null, class: classValue })
          }
        }
      }
      grades = Array.from(gradesSet).sort(smartSort)
      classes = Array.from(classesMap.values()).sort((a, b) =>
        a.class.localeCompare(b.class, 'zh-CN', { numeric: true })
      )
    }

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