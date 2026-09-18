// 同名用户消歧（姓名后追加年级/班级后缀）的统一口径

export interface DisambiguationUser {
  name?: string | null
  grade?: string | null
  class?: string | null
  status?: string | null
}

// 仅在读（active）用户参与重名统计，避免毕业/退学/待审批等不可见账号给在读用户姓名误加后缀
export const DISAMBIGUATION_ELIGIBLE_STATUS = 'active'

// 供原生 SQL 的 WITH 子句内插使用，需紧跟在 "WITH" 之后
export const NAME_DISAMBIGUATION_CTES = `
      user_name_counts AS (
        SELECT name, COUNT(*)::int AS name_count
        FROM "User"
        WHERE name IS NOT NULL AND status = '${DISAMBIGUATION_ELIGIBLE_STATUS}'
        GROUP BY name
      ),
      user_grade_counts AS (
        SELECT name, grade, COUNT(*)::int AS grade_count
        FROM "User"
        WHERE name IS NOT NULL AND status = '${DISAMBIGUATION_ELIGIBLE_STATUS}'
        GROUP BY name, grade
      )`

export const formatDisambiguatedName = (
  user?: DisambiguationUser | null,
  nameCount = 1,
  gradeCount = 1
) => {
  if (!user?.name) return '未知用户'
  if (nameCount <= 1 || !user.grade) return user.name
  if (gradeCount > 1 && user.class) return `${user.name}（${user.grade} ${user.class}）`
  return `${user.name}（${user.grade}）`
}

// 按消歧口径过滤并建立 姓名 -> 用户数组 映射，元素需含 name/grade/status（class 可选）
export const buildNameToUsersMap = <T extends DisambiguationUser>(users: T[]) => {
  const map = new Map<string, T[]>()
  users.forEach((u) => {
    if (u.name && u.status === DISAMBIGUATION_ELIGIBLE_STATUS) {
      if (!map.has(u.name)) {
        map.set(u.name, [])
      }
      map.get(u.name)!.push(u)
    }
  })
  return map
}

export const formatDisambiguatedNameFromMap = (
  user: DisambiguationUser | null | undefined,
  nameToUsers: Map<string, DisambiguationUser[]>
) => {
  const sameNameUsers = (user?.name && nameToUsers.get(user.name)) || []
  const gradeCount = user?.grade
    ? sameNameUsers.filter((u) => u.grade === user.grade).length
    : 1
  return formatDisambiguatedName(user, sameNameUsers.length, gradeCount)
}
