// 年级班级选项的纯函数核心（无 db 依赖，便于单测）

export const smartSort = (a: string, b: string) => {
  const gradeOrder: Record<string, number> = {
    '初一': 1, '初二': 2, '初三': 3,
    '高一': 4, '高二': 5, '高三': 6,
    '大一': 7, '大二': 8, '大三': 9, '大四': 10,
    '教师': 99, '教职工': 99
  }

  const weightA = gradeOrder[a]
  const weightB = gradeOrder[b]

  if (weightA !== undefined && weightB !== undefined) return weightA - weightB
  if (weightA !== undefined) return -1
  if (weightB !== undefined) return 1

  return a.localeCompare(b, 'zh-CN', { numeric: true })
}

export interface GradeClassOption {
  grade: string
  class: string
}

// 配置优先，配置为空时回退到用户提取；统一过滤空值与 smartSort 排序
export const resolveGradeClassOptions = (
  configItems: GradeClassOption[],
  fallbackItems: GradeClassOption[]
): GradeClassOption[] => {
  const source = configItems.length > 0 ? configItems : fallbackItems

  return source
    .filter((item): item is GradeClassOption => Boolean(item.grade?.trim()) && Boolean(item.class?.trim()))
    .sort((a, b) => {
      const gradeResult = smartSort(a.grade, b.grade)
      return gradeResult || smartSort(a.class, b.class)
    })
}