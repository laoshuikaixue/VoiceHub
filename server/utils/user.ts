/**
 * 获取用户状态的中文显示文本
 * @param status 用户状态枚举值
 * @returns 中文显示文本
 */
export function getStatusText(status: string | null | undefined): string {
  const statusMap: Record<string, string> = {
    active: '正常',
    withdrawn: '退学',
    graduate: '毕业生',
  };
  return status ? (statusMap[status] || status) : '未知';
}
