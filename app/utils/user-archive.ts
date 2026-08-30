/**
 * 账号归档判定与筛选参数解析。
 * 归档口径：账户状态为 graduate（限制访问-毕业生）或 withdrawn（限制访问-退学）
 * 即视为已归档，归档账号不在用户管理默认列表与学段中直接展示，
 * 收敛在组织树底部的归档节点中查看。
 */
export const ARCHIVED_USER_STATUSES = ['graduate', 'withdrawn'] as const

export type ArchivedFilter = 'archived' | 'unarchived' | 'all'

/**
 * 判断状态是否为归档状态。
 * @param status 用户状态枚举值
 */
export function isArchivedStatus(status: string | null | undefined): boolean {
  return (ARCHIVED_USER_STATUSES as readonly string[]).includes(status || '')
}

/**
 * 解析归档筛选参数：archived=1/true 仅查已归档；archived=0/false 排除已归档；缺省不限制。
 * @param value 查询参数（可能是数组）
 */
export function resolveArchivedFilter(value: string | string[] | undefined): ArchivedFilter {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === '1' || raw === 'true') return 'archived'
  if (raw === '0' || raw === 'false') return 'unarchived'
  return 'all'
}
