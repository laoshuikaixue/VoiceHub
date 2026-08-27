// 注册相关校验纯函数（本地注册与 OAuth 注册共用）

export const REMARK_MAX_LENGTH = 200

// 年级与班级必须成对填写，或全部留空
export const validateGradeClassPair = (
  grade: unknown,
  studentClass: unknown
): { code: string; message: string } | null => {
  const hasGrade = typeof grade === 'string' && grade.trim().length > 0
  const hasClass = typeof studentClass === 'string' && studentClass.trim().length > 0

  if (hasGrade !== hasClass) {
    return { code: 'AUTH_GRADE_CLASS_TOGETHER', message: '年级和班级需要同时选择，或全部留空' }
  }

  return null
}

// 站点开启"注册必须选择年级班级"时：年级或班级任一缺失即不满足必填要求
export const isGradeClassMissing = (grade: unknown, studentClass: unknown): boolean => {
  const hasGrade = typeof grade === 'string' && grade.trim().length > 0
  const hasClass = typeof studentClass === 'string' && studentClass.trim().length > 0
  return !hasGrade || !hasClass
}
