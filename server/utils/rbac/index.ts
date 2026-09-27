/**
 * RBAC 模块统一导出（S2 barrel）
 *
 * `routePermissionMap` 与 `policies` 归 S3：S3-B1 会**追加一行** `export * from './policies'`
 * （总纲 §9 批准的唯一例外），本文件其余内容由 S2 独占。
 */

export * from './constants.ts'
export * from './cache.ts'
export * from './resolvePermissions.ts'
export * from './fallback.ts'
export * from './legacyRoleCheck.ts'
export * from './guards.ts'
export * from './policies.ts'
