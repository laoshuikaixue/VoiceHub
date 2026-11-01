/**
 * 后台接口权限守卫表（唯一权威实现）。
 *
 * `/api/admin/**` 的准入只由本表决定：命中规则要求「站点级 priv:admin-console + 规则内任一域码」。
 * `p` 是相对 /api/admin/ 的路径模式，`*` 匹配单段，`**` 匹配一段或多段；字面段更多的规则优先。
 * 未登记的后台接口默认拒绝并记录日志。
 * 表与 server/api/admin 下的端点逐一对应，由 tests/server/admin-permission-routes.test.ts 校验等价性。
 */
import { PRIV_ADMIN_CONSOLE } from '../../app/utils/admin-permissions.ts'

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const GET_METHODS: readonly HttpMethod[] = ['GET', 'HEAD']
const WRITE_METHODS: readonly HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE']

export interface AdminRouteRule {
  /** 路径模式，相对 /api/admin/ */
  p: string
  /** 适用方法，缺省表示全部方法 */
  m?: readonly HttpMethod[]
  /** 至少命中其一 */
  any: readonly string[]
}

export const ADMIN_ROUTE_RULES: readonly AdminRouteRule[] = [
  // 概览
  { p: 'activities', m: GET_METHODS, any: ['activities:read'] },
  { p: 'stats', m: GET_METHODS, any: ['stats:read'] },
  { p: 'stats/*', m: GET_METHODS, any: ['stats:read'] },

  // 点歌与排期
  { p: 'songs/reject', m: WRITE_METHODS, any: ['songs:review'] },
  { p: 'songs/batch-reject', m: WRITE_METHODS, any: ['songs:review'] },
  { p: 'songs/delete', m: WRITE_METHODS, any: ['songs:delete'] },
  { p: 'songs', m: GET_METHODS, any: ['songs:read'] },
  { p: 'songs/*', m: GET_METHODS, any: ['songs:read'] },
  { p: 'songs', m: WRITE_METHODS, any: ['songs:write'] },
  { p: 'songs/*', m: WRITE_METHODS, any: ['songs:write'] },
  { p: 'schedule', m: GET_METHODS, any: ['schedule:read'] },
  { p: 'schedule/*', m: GET_METHODS, any: ['schedule:read'] },
  { p: 'schedule', m: WRITE_METHODS, any: ['schedule:write'] },
  { p: 'schedule/*', m: WRITE_METHODS, any: ['schedule:write'] },
  { p: 'replay-requests', m: GET_METHODS, any: ['replay-requests:read'] },
  { p: 'replay-requests/*', m: WRITE_METHODS, any: ['replay-requests:write'] },
  { p: 'play-times', m: GET_METHODS, any: ['play-times:read'] },
  { p: 'play-times/*', m: GET_METHODS, any: ['play-times:read'] },
  { p: 'play-times', m: WRITE_METHODS, any: ['play-times:write'] },
  { p: 'play-times/*', m: WRITE_METHODS, any: ['play-times:write'] },
  { p: 'request-times', m: GET_METHODS, any: ['request-times:read'] },
  { p: 'request-times/*', m: GET_METHODS, any: ['request-times:read'] },
  { p: 'request-times', m: WRITE_METHODS, any: ['request-times:write'] },
  { p: 'request-times/*', m: WRITE_METHODS, any: ['request-times:write'] },
  { p: 'semesters', m: GET_METHODS, any: ['semesters:read'] },
  { p: 'semesters/*', m: GET_METHODS, any: ['semesters:read'] },
  { p: 'semesters/*', m: ['DELETE'], any: ['semesters:delete'] },
  { p: 'semesters', m: WRITE_METHODS, any: ['semesters:write'] },
  { p: 'semesters/*', m: WRITE_METHODS, any: ['semesters:write'] },
  { p: 'card-codes/assign', m: WRITE_METHODS, any: ['card-codes:assign'] },
  { p: 'card-codes/recycle', m: WRITE_METHODS, any: ['card-codes:assign'] },
  { p: 'card-codes/delete', m: WRITE_METHODS, any: ['card-codes:delete'] },
  { p: 'card-codes', m: GET_METHODS, any: ['card-codes:read'] },
  { p: 'card-codes/*', m: GET_METHODS, any: ['card-codes:read'] },
  { p: 'card-codes', m: WRITE_METHODS, any: ['card-codes:write'] },
  { p: 'card-codes/*', m: WRITE_METHODS, any: ['card-codes:write'] },

  // 人员
  { p: 'users/export', m: GET_METHODS, any: ['users:export'] },
  { p: 'users/*/permissions', m: GET_METHODS, any: ['priv:grant'] },
  { p: 'users/*/permissions', m: WRITE_METHODS, any: ['priv:grant'] },
  { p: 'users/*/songs', m: GET_METHODS, any: ['users:read-songs'] },
  { p: 'users/*/approval', m: WRITE_METHODS, any: ['users:approve'] },
  { p: 'users/*/reset-password', m: WRITE_METHODS, any: ['users:reset-password'] },
  { p: 'users/*', m: ['DELETE'], any: ['users:delete'] },
  { p: 'users', m: GET_METHODS, any: ['users:read'] },
  { p: 'users/*', m: GET_METHODS, any: ['users:read'] },
  { p: 'users/**', m: GET_METHODS, any: ['users:read'] },
  { p: 'users', m: WRITE_METHODS, any: ['users:write'] },
  { p: 'users/*', m: WRITE_METHODS, any: ['users:write'] },
  { p: 'users/**', m: WRITE_METHODS, any: ['users:write'] },
  { p: 'grade-class', m: GET_METHODS, any: ['grade-class:read'] },
  { p: 'grade-class/*', m: GET_METHODS, any: ['grade-class:read'] },
  { p: 'grade-class/*', m: ['DELETE'], any: ['grade-class:delete'] },
  { p: 'grade-class', m: WRITE_METHODS, any: ['grade-class:write'] },
  { p: 'grade-class/*', m: WRITE_METHODS, any: ['grade-class:write'] },
  { p: 'blacklist', m: GET_METHODS, any: ['blacklist:read'] },
  { p: 'blacklist/*', m: GET_METHODS, any: ['blacklist:read'] },
  { p: 'blacklist/*', m: ['DELETE'], any: ['blacklist:delete'] },
  { p: 'blacklist', m: WRITE_METHODS, any: ['blacklist:write'] },
  { p: 'blacklist/*', m: WRITE_METHODS, any: ['blacklist:write'] },

  // 系统配置
  { p: 'system-settings/env-oauth', m: GET_METHODS, any: ['system-settings:secrets'] },
  { p: 'system-settings/env-oauth-import', m: WRITE_METHODS, any: ['system-settings:secrets'] },
  { p: 'system-settings/clear-aggregate-bindings', m: WRITE_METHODS, any: ['system-settings:secrets'] },
  { p: 'system-settings', m: GET_METHODS, any: ['system-settings:read'] },
  { p: 'system-settings/*', m: GET_METHODS, any: ['system-settings:read'] },
  { p: 'system-settings', m: WRITE_METHODS, any: ['system-settings:write'] },
  { p: 'system-settings/*', m: WRITE_METHODS, any: ['system-settings:write'] },
  { p: 'notifications/history/*', m: ['DELETE'], any: ['notifications:delete'] },
  { p: 'notifications/history', m: GET_METHODS, any: ['notifications:read'] },
  { p: 'notifications/history/*', m: GET_METHODS, any: ['notifications:read'] },
  { p: 'notifications', m: GET_METHODS, any: ['notifications:read'] },
  { p: 'notifications/*', m: GET_METHODS, any: ['notifications:read'] },
  { p: 'notifications/**', m: GET_METHODS, any: ['notifications:read'] },
  { p: 'notifications', m: WRITE_METHODS, any: ['notifications:write'] },
  { p: 'notifications/*', m: WRITE_METHODS, any: ['notifications:write'] },
  { p: 'notifications/**', m: WRITE_METHODS, any: ['notifications:write'] },
  { p: 'smtp/test-connection', m: WRITE_METHODS, any: ['smtp:test'] },
  { p: 'smtp/test-email', m: WRITE_METHODS, any: ['smtp:test'] },
  { p: 'smtp/*', m: WRITE_METHODS, any: ['smtp:write'] },
  { p: 'email-templates/preview', m: WRITE_METHODS, any: ['email-templates:read'] },
  { p: 'email-templates', m: GET_METHODS, any: ['email-templates:read'] },
  { p: 'email-templates/*', m: GET_METHODS, any: ['email-templates:read'] },
  { p: 'email-templates/*', m: ['DELETE'], any: ['email-templates:delete'] },
  { p: 'email-templates', m: ['DELETE'], any: ['email-templates:delete'] },
  { p: 'email-templates', m: WRITE_METHODS, any: ['email-templates:write'] },
  { p: 'email-templates/*', m: WRITE_METHODS, any: ['email-templates:write'] },
  { p: 'system-board', m: GET_METHODS, any: ['system-board:read'] },
  { p: 'system-board/*', m: GET_METHODS, any: ['system-board:read'] },
  { p: 'system-board/*', m: WRITE_METHODS, any: ['system-board:write'] },

  // 权限管理：角色权限模板（权限矩阵页）
  { p: 'permissions/matrix', m: GET_METHODS, any: ['priv:role-template'] },
  { p: 'permissions/matrix', m: WRITE_METHODS, any: ['priv:role-template'] },

  // 基础设施
  { p: 'api-keys', m: GET_METHODS, any: ['api-keys:read'] },
  { p: 'api-keys/*', m: GET_METHODS, any: ['api-keys:read'] },
  { p: 'api-keys', m: WRITE_METHODS, any: ['api-keys:write'] },
  { p: 'api-keys/*', m: WRITE_METHODS, any: ['api-keys:write'] },
  { p: 'backup/restore', m: WRITE_METHODS, any: ['backup:restore'] },
  { p: 'backup/restore-chunk', m: WRITE_METHODS, any: ['backup:restore'] },
  { p: 'backup/clear', m: WRITE_METHODS, any: ['database:reset'] },
  { p: 'backup', m: GET_METHODS, any: ['backup:read'] },
  { p: 'backup/*', m: GET_METHODS, any: ['backup:read'] },
  { p: 'backup/**', m: GET_METHODS, any: ['backup:read'] },
  { p: 'backup/*', m: WRITE_METHODS, any: ['backup:write'] },
  { p: 'backup/**', m: WRITE_METHODS, any: ['backup:write'] },
  { p: 'db-status', m: GET_METHODS, any: ['database:read'] },
  { p: 'database/status', m: GET_METHODS, any: ['database:read'] },
  { p: 'database/performance', m: GET_METHODS, any: ['database:read'] },
  { p: 'database/pool-status', m: GET_METHODS, any: ['database:read'] },
  { p: 'database/cleanup', m: WRITE_METHODS, any: ['database:maintenance'] },
  { p: 'database/reset', m: WRITE_METHODS, any: ['database:reset'] },
  { p: 'fix-sequence', m: WRITE_METHODS, any: ['database:maintenance'] },
  { p: 'music-source-plugins', m: GET_METHODS, any: ['music-source-plugins:read'] },
  { p: 'music-source-plugins/*', m: GET_METHODS, any: ['music-source-plugins:read'] },
  { p: 'music-source-plugins/**', m: GET_METHODS, any: ['music-source-plugins:read'] },
  { p: 'music-source-plugins', m: WRITE_METHODS, any: ['music-source-plugins:write'] },
  { p: 'music-source-plugins/*', m: WRITE_METHODS, any: ['music-source-plugins:write'] },
  { p: 'music-source-plugins/**', m: WRITE_METHODS, any: ['music-source-plugins:write'] }
]

export interface AdminRouteGuard {
  /** 必须全部命中 */
  all: readonly string[]
  /** 至少命中其一；deny 为 true 时直接拒绝 */
  any: readonly string[]
  /** 缺省策略拒绝未登记的写操作 */
  deny: boolean
  /** 是否命中缺省策略 */
  fallback: boolean
}

// `/api/admin/**` 之外仍存在少量历史管理员接口，也必须进入同一套权限判定。
export const LEGACY_PERMISSION_ROUTE_RULES: readonly AdminRouteRule[] = [
  { p: '/api/songs/add', m: ['POST'], any: ['songs:write'] },
  { p: '/api/songs/*/update', m: ['PUT'], any: ['songs:write'] },
  { p: '/api/songs/*/voters', m: GET_METHODS, any: ['songs:read'] },
  { p: '/api/system/reconnect', m: ['POST'], any: ['database:read'] },
  { p: '/api/system/status', m: GET_METHODS, any: ['system:read'] }
]

const ADMIN_API_PREFIX = '/api/admin'

function pathSegments(pathname: string): string[] {
  const rest = pathname === ADMIN_API_PREFIX ? '' : pathname.slice(ADMIN_API_PREFIX.length + 1)
  return rest.replace(/\/+$/, '').split('/').filter(Boolean)
}

// `**` 匹配一段或多段，`*` 匹配单段
function matchesPattern(pattern: readonly string[], segments: readonly string[]): boolean {
  if (!pattern.length) return !segments.length
  const [head, ...rest] = pattern
  if (head === '**') {
    for (let used = 1; used <= segments.length; used++) {
      if (matchesPattern(rest, segments.slice(used))) return true
    }
    return false
  }
  if (!segments.length) return false
  if (head !== '*' && head !== segments[0]) return false
  return matchesPattern(rest, segments.slice(1))
}

// 字面段越多越具体；同分时通配越少越具体
function specificity(rule: AdminRouteRule): number {
  const parts = rule.p.split('/')
  const literals = parts.filter((part) => part !== '*' && part !== '**').length
  const globstars = parts.filter((part) => part === '**').length
  const wildcards = parts.filter((part) => part === '*').length
  return literals * 100 - globstars * 10 - wildcards
}

function findRule(segments: readonly string[], method: string): AdminRouteRule | null {
  const matched = ADMIN_ROUTE_RULES.filter((rule) => {
    if (!matchesPattern(rule.p.split('/'), segments)) return false
    return !rule.m || rule.m.includes(method.toUpperCase() as HttpMethod)
  })
  if (!matched.length) return null
  matched.sort((a, b) => specificity(b) - specificity(a))
  return matched[0]
}

export function isAdminApiPath(pathname: string): boolean {
  return pathname === ADMIN_API_PREFIX || pathname.startsWith(`${ADMIN_API_PREFIX}/`)
}

export function resolveAdminRouteGuard(pathname: string, method: string): AdminRouteGuard | null {
  if (!isAdminApiPath(pathname)) return null

  const rule = findRule(pathSegments(pathname), method)
  if (rule) {
    return { all: [PRIV_ADMIN_CONSOLE], any: rule.any, deny: false, fallback: false }
  }

  return { all: [PRIV_ADMIN_CONSOLE], any: [], deny: true, fallback: true }
}

function findLegacyRule(pathname: string, method: string): AdminRouteRule | null {
  const segments = pathname.split('/').filter(Boolean)
  const matched = LEGACY_PERMISSION_ROUTE_RULES.filter((rule) => {
    if (!matchesPattern(rule.p.split('/').filter(Boolean), segments)) return false
    return !rule.m || rule.m.includes(method.toUpperCase() as HttpMethod)
  })
  if (!matched.length) return null
  matched.sort((a, b) => specificity(b) - specificity(a))
  return matched[0]
}

export function resolvePermissionRouteGuard(pathname: string, method: string): AdminRouteGuard | null {
  const adminGuard = resolveAdminRouteGuard(pathname, method)
  if (adminGuard) return adminGuard
  const rule = findLegacyRule(pathname, method)
  if (!rule) return null
  return { all: [PRIV_ADMIN_CONSOLE], any: rule.any, deny: false, fallback: false }
}
