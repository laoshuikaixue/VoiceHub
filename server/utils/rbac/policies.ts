/**
 * RBAC 具名策略（S3-B1 · D8 / R-06）
 *
 * 两类策略的边界必须记住（代码注释与回滚文档都写明，避免「关了开关仍拒绝」的误判）：
 *   - **主体策略**（`canXxx`）：判「当前登录用户能不能做这类事」，内部走 `requirePermission`，
 *     因此**受 `RBAC_ENABLED=false` 影响**（legacy 兜底）。它们只是薄封装，不新增判定逻辑。
 *   - **客体策略**（`assertCanMutateTarget` / `canAssignRole` / `canSeeAdminFields`）：
 *     判「当前用户能不能动**这个对象**」，是角色层级语义 —— **与 `RBAC_ENABLED` 无关，必须始终生效**。
 *
 * 具名策略的存在意义：把 `server/api/**` 里散落的角色字面量与内联数组收敛成可测试、可 grep 的名字。
 *
 * 本模块必须能被 plain node 直接 import（DB 访问在 resolvePermissions 内部动态 import）。
 */

import type { H3Event } from 'h3'
import { createApiError } from '../apiError.ts'
import { SERVER_ERROR_CODES } from '../../config/constants.ts'
import {
  LEGACY_PERMISSION_MAP,
  PERMISSIONS,
  PERSONAL_INTEGRATION_LEGACY_PERMISSION,
  ROLES,
  isPermissionKey,
  normalizePermission,
  type PermissionKey
} from './constants.ts'
import { isAdminRole, isSuperAdmin, requirePermission, type GuardDependencies } from './guards.ts'
import { requireActiveUser, type RequestUser } from './legacyRoleCheck.ts'

/**
 * 主体策略工厂（薄封装 `requirePermission`），返回已登录用户以便链式使用。
 *
 * key 写错会退化成 `undefined` → 所有人被静默拒绝；这里在**加载期**就抛错（部署即暴露）。
 */
function policy(key: PermissionKey) {
  if (!isPermissionKey(key)) {
    throw new Error(`[rbac/policies] 非法权限 key：${String(key)}（检查 PERMISSIONS.* 常量名是否拼错）`)
  }
  return (event: H3Event, deps?: GuardDependencies): Promise<RequestUser> => requirePermission(event, key, deps)
}

// ── 用户域 ──
export const canReadUsers = policy(PERMISSIONS.USER_READ)
export const canManageUsers = policy(PERMISSIONS.USER_MANAGE)
export const canChangeUserStatus = policy(PERMISSIONS.USER_STATUS)

// ── 歌曲 / 排期域 ──
export const canReadSongs = policy(PERMISSIONS.SONG_READ)
export const canWriteSongs = policy(PERMISSIONS.SONG_WRITE)
export const canRejectSongs = policy(PERMISSIONS.SONG_REJECT)
export const canReadSchedule = policy(PERMISSIONS.SCHEDULE_READ)
export const canWriteSchedule = policy(PERMISSIONS.SCHEDULE_WRITE)
export const canPublishSchedule = policy(PERMISSIONS.SCHEDULE_PUBLISH)

// ── 基础数据域 ──
export const canManagePlayTimes = policy(PERMISSIONS.PLAYTIMES_MANAGE)
export const canManageRequestTimes = policy(PERMISSIONS.REQUEST_TIMES_MANAGE)
export const canManageSemesters = policy(PERMISSIONS.SEMESTER_MANAGE)
export const canManageGradeClass = policy(PERMISSIONS.GRADE_CLASS_MANAGE)
export const canReadStats = policy(PERMISSIONS.STATS_READ)

// ── 卡密 / 黑名单 / 通知 ──
export const canReadCardCodes = policy(PERMISSIONS.CARD_CODES_READ)
export const canWriteCardCodes = policy(PERMISSIONS.CARD_CODES_WRITE)
export const canDeleteCardCodes = policy(PERMISSIONS.CARD_CODES_DELETE)
export const canManageBlacklist = policy(PERMISSIONS.BLACKLIST_MANAGE)
export const canSendNotifications = policy(PERMISSIONS.NOTIFICATION_SEND)

// ── 系统设置 / 邮件 / SMTP ──
export const canReadSystemSettings = policy(PERMISSIONS.SYSTEM_SETTINGS_READ)
export const canWriteSystemSettings = policy(PERMISSIONS.SYSTEM_SETTINGS_WRITE)
export const canManageEmailTemplates = policy(PERMISSIONS.EMAIL_TEMPLATES_MANAGE)
export const canManageSmtp = policy(PERMISSIONS.SMTP_MANAGE)

// ── 备份 / 数据库 ──
export const canExecuteBackup = policy(PERMISSIONS.BACKUP_EXECUTE)
export const canExportBackup = policy(PERMISSIONS.BACKUP_EXPORT)
export const canRestoreBackup = policy(PERMISSIONS.BACKUP_RESTORE)
export const canResetDatabase = policy(PERMISSIONS.DATABASE_RESET)

// ── API Key / 角色与权限管理 ──
export const canReadApiKeys = policy(PERMISSIONS.API_KEYS_READ)
export const canWriteApiKeys = policy(PERMISSIONS.API_KEYS_WRITE)
export const canManageApiKeys = policy(PERMISSIONS.API_KEYS_MANAGE)
export const canDeleteApiKeys = policy(PERMISSIONS.API_KEYS_DELETE)
export const canManageRoles = policy(PERMISSIONS.ROLE_MANAGE)
export const canReadPermissions = policy(PERMISSIONS.PERMISSIONS_READ)
export const canManagePermissions = policy(PERMISSIONS.PERMISSIONS_MANAGE)
export const canManageUserPermissions = policy(PERMISSIONS.USER_PERMISSIONS_MANAGE)

// ── 客体策略（D8）──────────────────────────────────────────────────────────────
// ⚠️ 边界：客体策略**不读 RBAC_ENABLED**，必须始终生效 —— 它们是角色层级语义，
//    与「权限表是否健康 / 是否回滚到 legacy」无关。回滚文档同样要写这句，否则会被误判成
//    「开关关了却还在拒绝」。

/** 能否对目标账号执行高权限操作（修改 / 删除 / 改状态 / 重置密码）。目标为 SUPER_ADMIN 时仅 SUPER_ADMIN 可操作 */
export function canMutateTarget(actor: unknown, target: unknown): boolean {
  if (!isSuperAdmin(target)) return true
  return isSuperAdmin(actor)
}

/** 能否把账号角色改为 nextRole（禁止把他人提权到 SUPER_ADMIN，除非操作者本身就是 SUPER_ADMIN） */
export function canAssignRole(actor: unknown, nextRole: string | null | undefined): boolean {
  if (nextRole !== ROLES.SUPER_ADMIN) return true
  return isSuperAdmin(actor)
}

/** 客体护栏：不满足即 403（401 / 403-账号异常由 requireActiveUser 统一给出） */
export function assertCanMutateTarget(
  event: H3Event,
  target: unknown,
  options: { message?: string } = {}
): RequestUser {
  const actor = requireActiveUser(event)
  if (!canMutateTarget(actor, target)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      options.message ?? '无权操作超级管理员账号'
    )
  }
  return actor
}

/** 客体护栏：禁止非 SUPER_ADMIN 把账号提权为 SUPER_ADMIN */
export function assertCanAssignRole(
  event: H3Event,
  nextRole: string | null | undefined,
  options: { message?: string } = {}
): RequestUser {
  const actor = requireActiveUser(event)
  if (!canAssignRole(actor, nextRole)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
      options.message ?? '无权将账号提升为超级管理员'
    )
  }
  return actor
}

/**
 * 响应塑形：是否可见管理字段（不抛错，非断言）。
 * 属客体语义（按角色塑形），与 RBAC_ENABLED 无关。
 */
export function canSeeAdminFields(actor: unknown): boolean {
  return isAdminRole(actor)
}

// ── 个人集成令牌（D-S1-a：端点不再硬编码冒号字符串）─────────────────────────────

/** 目标形态：catalog key（S5-4 把 api-auth 的校验词表统一到它之后的存储值） */
export const PERSONAL_INTEGRATION_PERMISSION = PERMISSIONS.SONG_READ

/**
 * 过渡期存储形态：legacy 冒号形。
 * 为什么还不是 catalog key：`server/middleware/api-auth.ts` 仍按冒号词表做精确比对，
 * 现在就把写入值切成 `song.read` 会让所有新令牌在 `/api/open/*` 上全量 403 —— 词表统一归 S5-4。
 */
export const PERSONAL_INTEGRATION_PERMISSION_STORED = PERSONAL_INTEGRATION_LEGACY_PERMISSION

/**
 * 该权限的全部等价写法（catalog key + 所有 legacy 写法），供过渡期 SQL 查询使用：
 * 这样存量行（冒号）与未来行（点分）都能被同一条查询命中，不需要先跑数据迁移。
 */
export const PERSONAL_INTEGRATION_PERMISSION_FORMS: readonly string[] = Object.freeze([
  PERSONAL_INTEGRATION_PERMISSION,
  ...Object.entries(LEGACY_PERMISSION_MAP)
    .filter(([, mapped]) => mapped === PERSONAL_INTEGRATION_PERMISSION)
    .map(([legacy]) => legacy)
])

/** 归一化判定：任何等价写法（含未来点分形）都算个人集成权限 */
export function isPersonalIntegrationPermission(value: string): boolean {
  return normalizePermission(value) === PERSONAL_INTEGRATION_PERMISSION
}
