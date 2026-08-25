// 学段权重权威定义（与 server/utils/grade-class-core.ts 保持一致；前端唯一引用源）
export const GRADE_ORDER = {
  初一: 1,
  初二: 2,
  初三: 3,
  高一: 4,
  高二: 5,
  高三: 6,
  大一: 7,
  大二: 8,
  大三: 9,
  大四: 10,
  教师: 99,
  教职工: 99
}

export const smartSort = (a, b) => {
  const weightA = GRADE_ORDER[a]
  const weightB = GRADE_ORDER[b]

  if (weightA !== undefined && weightB !== undefined) return weightA - weightB
  if (weightA !== undefined) return -1
  if (weightB !== undefined) return 1

  return a.localeCompare(b, 'zh-CN', { numeric: true })
}
