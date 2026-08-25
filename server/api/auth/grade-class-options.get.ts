import { fetchGradeClassOptions } from '~~/server/utils/grade-class-options'

// 公开的年级班级选项接口（注册表单使用，无需 binding-token）
export default defineEventHandler(async () => {
  const classes = await fetchGradeClassOptions()

  return {
    success: true,
    classes
  }
})
