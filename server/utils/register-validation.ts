// 注册相关校验纯函数（本地注册与 OAuth 注册共用）

export const REMARK_MAX_LENGTH = 200

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0

// 年级与班级必须成对填写，或全部留空
export const validateGradeClassPair = (
  grade: unknown,
  studentClass: unknown
): { code: string; message: string } | null => {
  if (hasText(grade) !== hasText(studentClass)) {
    return { code: 'AUTH_GRADE_CLASS_TOGETHER', message: '年级和班级需要同时选择，或全部留空' }
  }

  return null
}

// 站点开启"注册必须选择年级班级"时：年级或班级任一缺失即不满足必填要求
const isGradeClassMissing = (grade: unknown, studentClass: unknown): boolean => {
  return !hasText(grade) || !hasText(studentClass)
}

// 注册年级班级判定统一入口：必填开启时任一缺失即拒绝，否则要求成对填写或全部留空
export const resolveGradeClassError = (
  grade: unknown,
  studentClass: unknown,
  required = false
): { code: string; message: string } | null => {
  if (required && isGradeClassMissing(grade, studentClass)) {
    return { code: 'AUTH_GRADE_CLASS_REQUIRED', message: '注册时必须选择年级和班级' }
  }

  return validateGradeClassPair(grade, studentClass)
}
