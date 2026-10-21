/**
 * RBAC 运行时门禁（S5-4）：`routePermissionMap` 的**唯一运行时消费方**。
 *
 * 判定入口是 `classifyApiRoute(method, pathname)`，四态处置：
 *   - `public` / `login` → 放行（登录态与公开路径由 auth.ts 保证）；
 *   - `permission` 且 `/api/admin/**` → `requirePermission`（唯一权威 guard）；
 *   - `permission` 且 `/api/open/**` → 放行，判权仍归 api-auth.ts（按 API Key 权限判定，
 *     带审计日志与统一错误体；此处再判一次会造成双重判权与两套错误语义）；
 *   - `unmapped` → 403 拒绝。
 *
 * `unmapped ⇒ 拒绝` 是本中间件的核心价值：`/api/admin/**` 与 `/api/open/**` 在映射表里
 * **没有登录兜底**，若不在此拒绝，新增的 admin 路由会退化成「任何登录用户可访问」，
 * 而契约检查只在 CI 里拦得住。
 */

import { createApiError } from '../utils/apiError'
import { SERVER_ERROR_CODES } from '../config/constants'
import { classifyApiRoute } from '../utils/rbac/routePermissionMap'
import { requirePermission } from '../utils/rbac/guards'

const ADMIN_PREFIX = '/api/admin'

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** 未登记路由一律拒绝（admin / open 域没有「仅登录」兜底） */
function rejectUnmapped(event: Parameters<typeof requirePermission>[0], pathname: string): never {
  const target = `${event.method} ${pathname}`
  console.error(`[RBAC] 未登记的路由已被拒绝: ${target}`)
  throw createApiError(
    403,
    SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
    `接口未登记权限，已拒绝访问：${target}`
  )
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  // 只管 /api 域，其余（页面 / 静态资源）直接放行
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    return
  }

  const decision = classifyApiRoute(event.method, pathname)

  if (decision.decision === 'public' || decision.decision === 'login') {
    return
  }

  if (decision.decision === 'permission') {
    // /api/open/** 与 /api/songs/** 的判权分别归 api-auth.ts 与端点自身
    if (!isUnder(pathname, ADMIN_PREFIX)) {
      return
    }
    const permission = decision.permission
    if (!permission) {
      rejectUnmapped(event, pathname)
    }
    await requirePermission(event, permission)
    return
  }

  rejectUnmapped(event, pathname)
})
