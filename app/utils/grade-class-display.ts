// 年级班级展示串：账号页与用户管理共用，空值文案由调用方按语言传入
export const formatGradeClass = (grade?: string | null, studentClass?: string | null, emptyText = '-') => {
  if (!grade && !studentClass) return emptyText
  return [grade, studentClass].filter(Boolean).join(' ')
}
