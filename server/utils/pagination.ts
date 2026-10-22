/**
 * 统一分页参数解析。
 *
 * 背景：部分管理端点直接 `parseInt(query.limit) || 20`，攻击者可传入
 * limit=5000000 让数据库一次性物化海量行（含 requestBody / responseBody 等大字段），
 * 造成 PostgreSQL 与 Node 进程内存耗尽（DoS）。这里统一收敛，带默认值与硬上限。
 */

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

/**
 * @param pageInput 页码（从 1 开始）
 * @param limitInput 每页条数
 * @param defaultLimit 默认条数
 * @param maxLimit 硬上限，防止一次拉取过多数据
 */
export function resolvePagination(
  pageInput: unknown,
  limitInput: unknown,
  defaultLimit = 20,
  maxLimit = 200
): PaginationParams {
  const parsedPage = Number.parseInt(String(pageInput ?? '1'), 10)
  const parsedLimit = Number.parseInt(String(limitInput ?? defaultLimit), 10)

  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, maxLimit)
    : defaultLimit

  return { page, limit, offset: (page - 1) * limit }
}