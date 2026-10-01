/**
 * RBAC 常量（冻结导出名，slice-plan §5.5）
 *
 * 本文件是 shared/rbac/permission-catalog.js 的薄 re-export：
 * 权限 key、角色矩阵、legacy 映射的唯一权威定义都在 catalog 内，
 * 本文件不得出现任何权限 key 字面量（D4 / R-32），也不得再抄一份映射表。
 *
 * 导出名冻结：PERMISSIONS / ROLES / PermissionKey / LEGACY_PERMISSION_MAP /
 * GRANT_TYPES / Role / GrantType —— 一个都不许改名。
 *
 * 导入用相对路径而非 `#shared` 别名：catalog 必须能被 plain node 直接 import
 * （tests/** 走 `node --experimental-strip-types --test`，无别名解析器）。
 *
 * 类型说明：catalog 是 JS 模块（D4/D11 裁决），key 联合类型无法在 .js 内写成字面量
 * 联合，故 PermissionKey 的静态精度弱于手写枚举；运行时由 catalog 白名单校验兜底
 * （见 kernel resolvePermissions 的未知 key 拒绝）。
 */
import { GRANT_TYPES, PERMISSIONS, ROLES } from '../../../shared/rbac/permission-catalog.js'

export {
  API_PERMISSION_KEYS,
  CATALOG,
  CATALOG_VERSION,
  GRANT_TYPES,
  LEGACY_MIN_ROLE,
  LEGACY_PERMISSION_MAP,
  NAMING_RULE,
  PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSION_LIST,
  PERSONAL_INTEGRATION_LEGACY_PERMISSION,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  ROLES,
  isPermissionKey,
  minRoleOf,
  normalizePermission,
  roleHasPermission,
  roleRank
} from '../../../shared/rbac/permission-catalog.js'

export type Role = (typeof ROLES)[keyof typeof ROLES]
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
export type GrantType = (typeof GRANT_TYPES)[keyof typeof GRANT_TYPES]
