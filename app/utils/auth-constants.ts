/**
 * 客户端侧 re-export，保持 `~/utils/auth-constants` 导入路径不变。
 * 实际定义位于 shared/auth-constants.ts（服务端/客户端共用）。
 */
export { ADMIN_ROLES, isAdminRole } from '#shared/auth-constants'
export type { AdminRole } from '#shared/auth-constants'
