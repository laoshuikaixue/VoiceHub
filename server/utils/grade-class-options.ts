import { and, isNotNull, eq, ne, sql } from 'drizzle-orm'
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

// 组合合法性校验：与选项数据源严格一致——配置非空时仅接受配置组合；
// 配置为空时才回退到现有 active 用户组合
export async function isGradeClassValid(grade: string, studentClass: string): Promise<boolean> {
  const configHit = await db.query.gradeClass.findFirst({
    where: (t, { eq: eq_, and: and_ }) => and_(eq_(t.grade, grade), eq_(t.class, studentClass)),
    columns: { id: true }
  })

  if (configHit) return true

  // 配置表存在有效行时不再接受用户存量组合（与注册表单选项一致，防绕过配置优先）
  const configCount = await db
    .select({ count: () => sql<number>`count(*)::int` })
    .from(gradeClass)
    .where(and(ne(gradeClass.grade, ''), ne(gradeClass.class, '')))
  if ((configCount[0]?.count || 0) > 0) return false

  const userHit = await db.query.users.findFirst({
    where: (t, { eq: eq_, and: and_ }) =>
      and_(eq_(t.status, 'active'), eq_(t.grade, grade), eq_(t.class, studentClass)),
    columns: { id: true }
  })

  return Boolean(userHit)
}
