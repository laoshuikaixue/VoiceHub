// 权威实现收敛到 app/utils/adminPermissions，此处仅保持服务端导入路径可用
export {
  ADMIN_ACCESS_ROLES,
  SUPER_ADMIN_ROLES,
  SYSTEM_ADMIN_ROLES,
  isAdminPermissionCode,
  isConfigurablePermissionRole,
  normalizePermissionCodes,
  resolveEffectivePermissions
} from '~~/app/utils/adminPermissions'
export type { AdminPermissionCode } from '~~/app/utils/adminPermissions'
