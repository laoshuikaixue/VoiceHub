import { and, isNotNull, eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users, gradeClass } from '~/drizzle/schema'
import { resolveGradeClassOptions, type GradeClassOption } from './grade-class-core'

// 年级班级选项：优先读管理员配置表，未配置时从 active 用户中提取（注册表单与 OAuth 注册共用）
export async function fetchGradeClassOptions(): Promise<GradeClassOption[]> {
  const [configRows, userRows] = await Promise.all([
    db.select({
      grade: gradeClass.grade,
      class: gradeClass.class
    }).from(gradeClass),
    db
      .selectDistinct({
        grade: users.grade,
        class: users.class
      })
      .from(users)
      .where(and(eq(users.status, 'active'), isNotNull(users.grade), isNotNull(users.class)))
  ])

  return resolveGradeClassOptions(configRows, userRows)
}

// 组合合法性校验：配置表命中或现有 active 用户命中均可（与选项数据源语义一致）
export async function isGradeClassValid(grade: string, studentClass: string): Promise<boolean> {
  const [configHit, userHit] = await Promise.all([
    db.query.gradeClass.findFirst({
      where: (t, { eq: eq_, and: and_ }) => and_(eq_(t.grade, grade), eq_(t.class, studentClass)),
      columns: { id: true }
    }),
    db.query.users.findFirst({
      where: (t, { eq: eq_, and: and_ }) =>
        and_(eq_(t.status, 'active'), eq_(t.grade, grade), eq_(t.class, studentClass)),
      columns: { id: true }
    })
  ])

  return Boolean(configHit || userHit)
}