/**
 * 获取用户状态的中文显示文本
 * @param status 用户状态枚举值
 * @returns 中文显示文本
 */
export function getStatusText(status: string | null | undefined): string {
  if (status === 'active') return '正常'
  if (status === 'withdrawn') return '退学'
  if (status === 'graduate') return '毕业生'
  return status || '未知'
}
