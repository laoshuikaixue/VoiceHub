/**
 * 统一分页解析：page ≥ 1，limit 夹取到 [1, maxLimit]，返回 offset。
 * 管理端点直接透传 limit 会让 limit=999999 一次性把全表拉进内存，此处集中夹紧上限。
 */
export function resolvePagination(
  pageInput: unknown,
  limitInput: unknown,
  defaultLimit: number,
  maxLimit: number
): { page: number; limit: number; offset: number } {
  const parsedPage = Number.parseInt(String(pageInput ?? ''), 10)
  const parsedLimit = Number.parseInt(String(limitInput ?? ''), 10)

  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1
  const rawLimit = Number.isFinite(parsedLimit) && parsedLimit >= 1 ? parsedLimit : defaultLimit
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit)

  return { page, limit, offset: (page - 1) * limit }
}
