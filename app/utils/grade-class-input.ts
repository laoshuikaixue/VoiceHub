// 解析班级批量输入：逗号/换行分隔；数字区间 "1-10" 生成 "1班".."10班"（上限 100 防呆）

const MAX_RANGE_LENGTH = 100

export const parseClassInput = (text: unknown): string[] => {
  if (typeof text !== 'string') return []

  const segments = text
    .split(/[,，\n;；]/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const result: string[] = []

  for (const segment of segments) {
    const rangeMatch = segment.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      if (start >= 1 && end >= start && end - start < MAX_RANGE_LENGTH) {
        for (let i = start; i <= end; i++) {
          result.push(`${i}班`)
        }
        continue
      }
    }

    result.push(segment)
  }

  return [...new Set(result)]
}