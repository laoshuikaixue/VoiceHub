/**
 * 数据库驱动错误的统一读取工具。
 *
 * drizzle-orm 会把驱动抛出的错误包装成 DrizzleQueryError，真正的 PostgreSQL
 * 错误码只保留在 `error.cause.code` 上；只读 `error.code` 会永远拿不到错误码。
 */

/** 读取 PostgreSQL 错误码；无法判定时返回空字符串。 */
export function pgErrorCode(error: unknown): string {
  const value = error as { code?: string; cause?: { code?: string } } | null
  return String(value?.code || value?.cause?.code || '')
}

/** 是否为唯一约束冲突（PostgreSQL 23505）。 */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505'
}
