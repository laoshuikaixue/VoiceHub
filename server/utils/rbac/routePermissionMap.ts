/**
 * 路径 → 权限 路由注册中心
 *
 * 替代 server/middleware/api-auth.ts 的 getRequiredPermission 硬编码 switch
 * 替代 server/utils/permissions.js 的角色 → 页面映射
 *
 * 匹配算法：第一条命中规则胜出（顺序敏感，精确路由在通配路由之前）
 */

import { PERMISSIONS, type PermissionKey } from './constants'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RouteRule = {
  method?: HttpMethod | HttpMethod[] // 缺省 = 所有方法
  permission: PermissionKey
}

export type RouteMatcher = {
  matcher: RegExp
  rule: RouteRule
}

// 顺序敏感：精确路径在前，通配在后
export const routePermissionMap: RouteMatcher[] = [
  // rbac 管理接口
  { matcher: /^\/api\/admin\/rbac\/permissions$/, rule: { method: 'GET', permission: PERMISSIONS.PERMISSIONS_READ } },
  { matcher: /^\/api\/admin\/rbac\/roles\/[^/]+$/, rule: { method: 'PUT', permission: PERMISSIONS.ROLE_MANAGE } },
  { matcher: /^\/api\/admin\/rbac\/roles$/, rule: { method: 'GET', permission: PERMISSIONS.PERMISSIONS_READ } },
  { matcher: /^\/api\/admin\/rbac\/user-permissions$/, rule: { method: 'GET', permission: PERMISSIONS.USER_PERMISSIONS_MANAGE } },
  { matcher: /^\/api\/admin\/rbac\/user-permissions\/\d+$/, rule: { method: 'DELETE', permission: PERMISSIONS.USER_PERMISSIONS_MANAGE } },
  { matcher: /^\/api\/admin\/rbac\/user-permissions\/[^/]+$/, rule: { method: 'POST', permission: PERMISSIONS.USER_PERMISSIONS_MANAGE } },
  { matcher: /^\/api\/admin\/rbac\/my-permissions$/, rule: { method: 'GET', permission: PERMISSIONS.PERMISSIONS_READ } },

  // api-keys
  { matcher: /^\/api\/admin\/api-keys\/logs$/, rule: { method: 'GET', permission: PERMISSIONS.API_KEYS_MANAGE } },
  { matcher: /^\/api\/admin\/api-keys\/[^/]+\/stats$/, rule: { method: 'GET', permission: PERMISSIONS.API_KEYS_READ } },
  { matcher: /^\/api\/admin\/api-keys\/[^/]+\/abnormal-logs$/, rule: { method: 'GET', permission: PERMISSIONS.API_KEYS_MANAGE } },
  { matcher: /^\/api\/admin\/api-keys\/[^/]+$/, rule: { method: 'DELETE', permission: PERMISSIONS.API_KEYS_DELETE } },
  { matcher: /^\/api\/admin\/api-keys$/, rule: { method: 'POST', permission: PERMISSIONS.API_KEYS_WRITE } },
  { matcher: /^\/api\/admin\/api-keys$/, rule: { method: 'GET', permission: PERMISSIONS.API_KEYS_READ } },

  // users
  { matcher: /^\/api\/admin\/users\/options$/, rule: { method: 'GET', permission: PERMISSIONS.USER_READ } },
  { matcher: /^\/api\/admin\/users\/batch$/, rule: { method: 'POST', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users\/batch-status$/, rule: { method: 'PUT', permission: PERMISSIONS.USER_STATUS } },
  { matcher: /^\/api\/admin\/users\/batch-update$/, rule: { method: 'POST', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users\/batch-grade-update$/, rule: { method: 'POST', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users\/status-logs$/, rule: { method: 'GET', permission: PERMISSIONS.USER_READ } },
  { matcher: /^\/api\/admin\/users\/\d+\/reset-password$/, rule: { method: 'POST', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users\/\d+\/status$/, rule: { method: 'PUT', permission: PERMISSIONS.USER_STATUS } },
  { matcher: /^\/api\/admin\/users\/\d+\/status-logs$/, rule: { method: 'GET', permission: PERMISSIONS.USER_READ } },
  { matcher: /^\/api\/admin\/users\/\d+$/, rule: { method: 'PUT', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users\/\d+$/, rule: { method: 'DELETE', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users$/, rule: { method: 'POST', permission: PERMISSIONS.USER_MANAGE } },
  { matcher: /^\/api\/admin\/users$/, rule: { method: 'GET', permission: PERMISSIONS.USER_READ } },

  // system settings
  { matcher: /^\/api\/admin\/system-settings\/env-oauth$/, rule: { method: 'GET', permission: PERMISSIONS.SYSTEM_SETTINGS_READ } },
  { matcher: /^\/api\/admin\/system-settings\/env-oauth-import$/, rule: { method: 'POST', permission: PERMISSIONS.SYSTEM_SETTINGS_WRITE } },
  { matcher: /^\/api\/admin\/system-settings\/clear-aggregate-bindings$/, rule: { method: 'POST', permission: PERMISSIONS.SYSTEM_SETTINGS_WRITE } },
  { matcher: /^\/api\/admin\/system-settings$/, rule: { method: 'POST', permission: PERMISSIONS.SYSTEM_SETTINGS_WRITE } },
  { matcher: /^\/api\/admin\/system-settings$/, rule: { method: 'GET', permission: PERMISSIONS.SYSTEM_SETTINGS_READ } },

  // smtp
  { matcher: /^\/api\/admin\/smtp\/.+$/, rule: { method: 'POST', permission: PERMISSIONS.SMTP_MANAGE } },

  // blacklist
  { matcher: /^\/api\/admin\/blacklist$/, rule: { method: 'POST', permission: PERMISSIONS.BLACKLIST_MANAGE } },

  // stats
  { matcher: /^\/api\/admin\/stats\/realtime$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },
  { matcher: /^\/api\/admin\/stats\/user-engagement$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },
  { matcher: /^\/api\/admin\/stats\/trends$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },
  { matcher: /^\/api\/admin\/stats\/top-songs$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },
  { matcher: /^\/api\/admin\/stats\/semester-comparison$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },
  { matcher: /^\/api\/admin\/stats\/active-users$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },
  { matcher: /^\/api\/admin\/stats$/, rule: { method: 'GET', permission: PERMISSIONS.STATS_READ } },

  // backup
  { matcher: /^\/api\/admin\/backup\/export$/, rule: { method: 'POST', permission: PERMISSIONS.BACKUP_EXPORT } },
  { matcher: /^\/api\/admin\/backup\/restore$/, rule: { method: 'POST', permission: PERMISSIONS.BACKUP_RESTORE } },
  { matcher: /^\/api\/admin\/backup\/restore-chunk$/, rule: { method: 'POST', permission: PERMISSIONS.BACKUP_RESTORE } },
  { matcher: /^\/api\/admin\/backup\/.+$/, rule: { method: 'POST', permission: PERMISSIONS.BACKUP_EXECUTE } },

  // email templates
  { matcher: /^\/api\/admin\/email-templates\/.+$/, rule: { method: 'POST', permission: PERMISSIONS.EMAIL_TEMPLATES_MANAGE } },
  { matcher: /^\/api\/admin\/email-templates$/, rule: { method: 'POST', permission: PERMISSIONS.EMAIL_TEMPLATES_MANAGE } },
  { matcher: /^\/api\/admin\/email-templates$/, rule: { method: 'GET', permission: PERMISSIONS.EMAIL_TEMPLATES_MANAGE } },
  { matcher: /^\/api\/admin\/email-templates$/, rule: { method: 'DELETE', permission: PERMISSIONS.EMAIL_TEMPLATES_MANAGE } },

  // database
  { matcher: /^\/api\/admin\/database\/reset$/, rule: { method: 'POST', permission: PERMISSIONS.DATABASE_RESET } },

  // notifications
  { matcher: /^\/api\/admin\/notifications\/send$/, rule: { method: 'POST', permission: PERMISSIONS.NOTIFICATION_SEND } },
  { matcher: /^\/api\/admin\/notifications\/history\/.+$/, rule: { permission: PERMISSIONS.NOTIFICATION_SEND } },
  { matcher: /^\/api\/admin\/notifications\/history$/, rule: { method: 'GET', permission: PERMISSIONS.NOTIFICATION_SEND } },

  // replay requests
  { matcher: /^\/api\/admin\/replay-requests\/.+$/, rule: { method: 'POST', permission: PERMISSIONS.SONG_REJECT } },
  { matcher: /^\/api\/admin\/replay-requests$/, rule: { method: 'GET', permission: PERMISSIONS.SONG_REJECT } },

  // grade class
  { matcher: /^\/api\/admin\/grade-class\/.+$/, rule: { permission: PERMISSIONS.GRADE_CLASS_MANAGE } },

  // schedule
  { matcher: /^\/api\/admin\/schedule\/song-pool\/.+$/, rule: { permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/remove-all-date$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/publish$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_PUBLISH } },
  { matcher: /^\/api\/admin\/schedule\/move-date$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/draft$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/copy$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/bulk-publish$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_PUBLISH } },
  { matcher: /^\/api\/admin\/schedule\/sequence$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/remove$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/schedule\/full$/, rule: { method: 'GET', permission: PERMISSIONS.SCHEDULE_READ } },
  { matcher: /^\/api\/admin\/schedule(\/|$)/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },
  { matcher: /^\/api\/admin\/fix-sequence$/, rule: { method: 'POST', permission: PERMISSIONS.SCHEDULE_WRITE } },

  // semesters
  { matcher: /^\/api\/admin\/semesters\/set-active$/, rule: { method: 'POST', permission: PERMISSIONS.SEMESTER_MANAGE } },
  { matcher: /^\/api\/admin\/semesters\/.+$/, rule: { permission: PERMISSIONS.SEMESTER_MANAGE } },
  { matcher: /^\/api\/admin\/semesters$/, rule: { permission: PERMISSIONS.SEMESTER_MANAGE } },

  // play times / request times
  { matcher: /^\/api\/admin\/play-times(\/|$)/, rule: { permission: PERMISSIONS.PLAYTIMES_MANAGE } },
  { matcher: /^\/api\/admin\/request-times(\/|$)/, rule: { permission: PERMISSIONS.REQUEST_TIMES_MANAGE } },

  // card codes
  { matcher: /^\/api\/admin\/card-codes\/.+$/, rule: { permission: PERMISSIONS.CARD_CODES_WRITE } },
  { matcher: /^\/api\/admin\/card-codes$/, rule: { method: 'GET', permission: PERMISSIONS.CARD_CODES_READ } },

  // songs
  { matcher: /^\/api\/admin\/songs\/duration$/, rule: { method: 'POST', permission: PERMISSIONS.SONG_WRITE } },
  { matcher: /^\/api\/admin\/songs\/reject$/, rule: { method: 'POST', permission: PERMISSIONS.SONG_REJECT } },
  { matcher: /^\/api\/admin\/songs\/mark-played$/, rule: { method: 'POST', permission: PERMISSIONS.SONG_WRITE } },
  { matcher: /^\/api\/admin\/songs\/delete$/, rule: { method: 'POST', permission: PERMISSIONS.SONG_WRITE } }
]

/**
 * 解析路径 + 方法所需权限
 * @returns 权限 key，若未配置则返回 null（默认拒绝）
 */
export function resolveRoutePermission(pathname: string, method: string): PermissionKey | null {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const upperMethod = method.toUpperCase() as HttpMethod

  for (const entry of routePermissionMap) {
    if (!entry.matcher.test(normalized)) continue
    const { method: ruleMethod, permission } = entry.rule
    if (!ruleMethod) return permission
    const methods = Array.isArray(ruleMethod) ? ruleMethod : [ruleMethod]
    if (methods.includes(upperMethod)) return permission
  }
  return null
}
