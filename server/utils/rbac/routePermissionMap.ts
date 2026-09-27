/**
 * 路由权限注册中心（S3-B1 · §5.2 / D8）
 *
 * 职责：`(method, pathname) → 判定`。**第一条命中胜出**；未命中 ⇒ `unmapped`（运行时按拒绝处理）。
 *
 * 判定词汇（必须区分，否则会把普通用户接口全判成拒绝）：
 *   - `permission`：需要某个 catalog 权限 —— `server/api/admin/**` 与 `server/api/open/**`
 *     （后者按 API Key 权限判定，key 必须 `isApiPermission`）；
 *   - `login`：仅需登录（普通用户自己的接口）；
 *   - `public`：无需认证（登录 / 注册 / 公开配置 / 服务器时间等）；
 *   - `unmapped`：未分类 —— **默认拒绝**；`scripts/contract-checks/route-coverage.mjs` 会断言
 *     `server/api/**` 每条路由都被显式分类，因此 `unmapped` 只可能来自新增文件（当轮被拦下）。
 *
 * 与现状的差异（B1 阶段本表**不接线**，故无运行时行为变化；下列差异由各自的 S3 批次在等价性
 * 测试里显式登记为「有意行为变更」后才会生效）：
 *   1. api-keys 域：现状 7 个端点全 SUPER_ADMIN → 本表按 catalog 取 `api_keys.read/write/delete`
 *      （ADMIN 起）＝放宽，归 S5-5（其验收已明示）。
 *   2. backup 域：现状全 SUPER_ADMIN → 本表拆成 `backup.restore` / `backup.export` / `backup.execute`
 *      （execute 起 ADMIN）＝部分放宽，归 S3-B4-3 登记。
 *   3. database 域：现状 `reset` 允许 ADMIN、其余 4 个读取端点**无守卫** → 统一 `database.reset`
 *      （SUPER_ADMIN）＝收紧（与 catalog 一致，S3-B4-4 验收明示）。
 *   4. card-codes 删除：现状 SONG_ADMIN 可删 → `card_codes.delete`（SUPER_ADMIN）＝收紧。
 *   5. system-settings 写入类（如 `env-oauth-import`）：现状 ADMIN → `system_settings.write`
 *      （SUPER_ADMIN）＝收紧，归 S3-B4-1 登记。
 *   6. 现状**无守卫**的端点（music-source-plugins 8 个、notifications 5 个、`users/[id]/songs` 等）：
 *      本表给出目标权限（插件配置 → `system_settings.*`、通知 → `notification.send`、
 *      用户详情 → `user.read`），从「任何登录用户」收紧，归相应批次登记。
 *
 * 本模块必须能被 plain node 直接 import（无 Nuxt 别名；单测与契约检查都直接跑它）。
 */

import { PERMISSIONS, isPermissionKey, type PermissionKey } from './constants.ts'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type RouteDecision = {
  /** permission = 需权限；login = 仅需登录；public = 免认证；unmapped = 未分类（拒绝） */
  decision: 'permission' | 'login' | 'public' | 'unmapped'
  permission: PermissionKey | null
  /** 命中的规则说明（便于排障与契约输出） */
  matched: string | null
}

export type RouteRule = {
  method: HttpMethod | 'ANY'
  pattern: RegExp
  key: PermissionKey
  note?: string
}

/**
 * 受权限保护的路由规则（**顺序敏感**：更具体的路径必须排在更宽的前缀之前）。
 * 所有 key 都必须是 catalog 内的合法权限（契约检查逐条断言）。
 */
export const ROUTE_RULES: readonly RouteRule[] = Object.freeze([
  // ── RBAC 管理（S3-B5 交付的端点，须先于其它前缀注册）──
  { method: 'GET', pattern: /^\/api\/admin\/rbac\/my-permissions$/, key: PERMISSIONS.PERMISSIONS_READ, note: '本人权限只读（S4 镜像用）' },
  { method: 'GET', pattern: /^\/api\/admin\/rbac\/permissions$/, key: PERMISSIONS.PERMISSIONS_READ },
  { method: 'GET', pattern: /^\/api\/admin\/rbac\/roles$/, key: PERMISSIONS.PERMISSIONS_READ },
  { method: 'PUT', pattern: /^\/api\/admin\/rbac\/roles\/[^/]+$/, key: PERMISSIONS.ROLE_MANAGE },
  { method: 'GET', pattern: /^\/api\/admin\/rbac\/user-permissions$/, key: PERMISSIONS.PERMISSIONS_READ },
  { method: 'POST', pattern: /^\/api\/admin\/rbac\/user-permissions$/, key: PERMISSIONS.USER_PERMISSIONS_MANAGE },
  { method: 'DELETE', pattern: /^\/api\/admin\/rbac\/user-permissions\/[^/]+$/, key: PERMISSIONS.USER_PERMISSIONS_MANAGE },

  // ── users 域（读 / 管理 / 状态三线分开）──
  // 注意：`[id]/songs` 必须先于下面的 users 宽规则注册（它返回歌曲数据、旧行为含 SONG_ADMIN）
  { method: 'GET', pattern: /^\/api\/admin\/users\/[^/]+\/songs$/, key: PERMISSIONS.SONG_READ, note: '用户歌曲视图（旧行为：SONG_ADMIN 及以上）' },
  { method: 'GET', pattern: /^\/api\/admin\/users(\/.*)?$/, key: PERMISSIONS.USER_READ, note: '含 export/options/status-logs/[id]/[id]/status-logs' },
  { method: 'PUT', pattern: /^\/api\/admin\/users\/batch-status$/, key: PERMISSIONS.USER_STATUS },
  { method: 'PUT', pattern: /^\/api\/admin\/users\/[^/]+\/status$/, key: PERMISSIONS.USER_STATUS },
  { method: 'POST', pattern: /^\/api\/admin\/users\/[^/]+\/approval$/, key: PERMISSIONS.USER_STATUS, note: '审批＝状态流转' },
  { method: 'ANY', pattern: /^\/api\/admin\/users(\/.*)?$/, key: PERMISSIONS.USER_MANAGE },

  // ── songs 域 ──
  { method: 'POST', pattern: /^\/api\/admin\/songs\/(batch-reject|reject)$/, key: PERMISSIONS.SONG_REJECT },
  { method: 'ANY', pattern: /^\/api\/admin\/songs(\/.*)?$/, key: PERMISSIONS.SONG_WRITE },

  // ── schedule 域（publish 与 write 分开）──
  { method: 'POST', pattern: /^\/api\/admin\/schedule\/(publish|bulk-publish)$/, key: PERMISSIONS.SCHEDULE_PUBLISH },
  { method: 'GET', pattern: /^\/api\/admin\/schedule(\/.*)?$/, key: PERMISSIONS.SCHEDULE_READ },
  { method: 'ANY', pattern: /^\/api\/admin\/schedule(\/.*)?$/, key: PERMISSIONS.SCHEDULE_WRITE },

  // ── 基础数据域 ──
  { method: 'ANY', pattern: /^\/api\/admin\/play-times(\/.*)?$/, key: PERMISSIONS.PLAYTIMES_MANAGE },
  { method: 'ANY', pattern: /^\/api\/admin\/request-times(\/.*)?$/, key: PERMISSIONS.REQUEST_TIMES_MANAGE },
  { method: 'ANY', pattern: /^\/api\/admin\/semesters(\/.*)?$/, key: PERMISSIONS.SEMESTER_MANAGE },
  { method: 'ANY', pattern: /^\/api\/admin\/grade-class(\/.*)?$/, key: PERMISSIONS.GRADE_CLASS_MANAGE },
  { method: 'GET', pattern: /^\/api\/admin\/replay-requests(\/.*)?$/, key: PERMISSIONS.SONG_READ },
  { method: 'POST', pattern: /^\/api\/admin\/replay-requests\/reject$/, key: PERMISSIONS.SONG_REJECT },

  // ── 统计 / 概览 ──
  { method: 'GET', pattern: /^\/api\/admin\/(stats|activities)(\/.*)?$/, key: PERMISSIONS.STATS_READ },

  // ── 卡密域（删除单独收紧）──
  { method: 'POST', pattern: /^\/api\/admin\/card-codes\/delete$/, key: PERMISSIONS.CARD_CODES_DELETE },
  { method: 'GET', pattern: /^\/api\/admin\/card-codes(\/.*)?$/, key: PERMISSIONS.CARD_CODES_READ },
  { method: 'ANY', pattern: /^\/api\/admin\/card-codes(\/.*)?$/, key: PERMISSIONS.CARD_CODES_WRITE },

  // ── 黑名单 ──
  { method: 'ANY', pattern: /^\/api\/admin\/blacklist(\/.*)?$/, key: PERMISSIONS.BLACKLIST_MANAGE },

  // ── 系统设置 / 邮件 / SMTP（写入统一 SUPER_ADMIN）──
  { method: 'GET', pattern: /^\/api\/admin\/(system-settings|db-status)(\/.*)?$/, key: PERMISSIONS.SYSTEM_SETTINGS_READ },
  { method: 'ANY', pattern: /^\/api\/admin\/system-settings(\/.*)?$/, key: PERMISSIONS.SYSTEM_SETTINGS_WRITE },
  { method: 'ANY', pattern: /^\/api\/admin\/email-templates(\/.*)?$/, key: PERMISSIONS.EMAIL_TEMPLATES_MANAGE },
  { method: 'ANY', pattern: /^\/api\/admin\/smtp(\/.*)?$/, key: PERMISSIONS.SMTP_MANAGE },

  // ── 音源插件（现状无守卫 → 按站点配置域收紧）──
  { method: 'GET', pattern: /^\/api\/admin\/music-source-plugins(\/.*)?$/, key: PERMISSIONS.SYSTEM_SETTINGS_READ },
  { method: 'ANY', pattern: /^\/api\/admin\/music-source-plugins(\/.*)?$/, key: PERMISSIONS.SYSTEM_SETTINGS_WRITE },

  // ── 通知 ──
  { method: 'ANY', pattern: /^\/api\/admin\/notifications(\/.*)?$/, key: PERMISSIONS.NOTIFICATION_SEND },

  // ── API Key 管理（catalog 语义；现状 SUPER_ADMIN-only，放宽归 S5-5）──
  { method: 'GET', pattern: /^\/api\/admin\/api-keys(\/.*)?$/, key: PERMISSIONS.API_KEYS_READ },
  { method: 'POST', pattern: /^\/api\/admin\/api-keys(\/.*)?$/, key: PERMISSIONS.API_KEYS_WRITE },
  { method: 'PUT', pattern: /^\/api\/admin\/api-keys(\/.*)?$/, key: PERMISSIONS.API_KEYS_WRITE },
  { method: 'DELETE', pattern: /^\/api\/admin\/api-keys(\/.*)?$/, key: PERMISSIONS.API_KEYS_DELETE },

  // ── 备份域（restore / export 精确优先于 execute）──
  { method: 'POST', pattern: /^\/api\/admin\/backup\/restore(-chunk)?$/, key: PERMISSIONS.BACKUP_RESTORE },
  { method: 'POST', pattern: /^\/api\/admin\/backup\/export$/, key: PERMISSIONS.BACKUP_EXPORT },
  { method: 'GET', pattern: /^\/api\/admin\/backup\/download(\/.*)?$/, key: PERMISSIONS.BACKUP_EXPORT },
  { method: 'ANY', pattern: /^\/api\/admin\/backup(\/.*)?$/, key: PERMISSIONS.BACKUP_EXECUTE },

  // ── 数据库 / 序列修复（统一 SUPER_ADMIN；reset 属收紧，见文件头第 3 条）──
  { method: 'ANY', pattern: /^\/api\/admin\/(database|fix-sequence)(\/.*)?$/, key: PERMISSIONS.DATABASE_RESET }
])

/**
 * `/api/open/**`：按 API Key 权限判定。
 * key 必须是 catalog 中 `isApiPermission === true` 的项（契约检查逐条断言）——
 * 否则历史 API Key 归一化后仍然不可用（上一轮 403 事故的同源风险）。
 */
export const OPEN_ROUTE_RULES: readonly RouteRule[] = Object.freeze([
  { method: 'POST', pattern: /^\/api\/open\/card-codes\/delete$/, key: PERMISSIONS.CARD_CODES_DELETE, note: '历史「路径后缀」形式' },
  { method: 'GET', pattern: /^\/api\/open\/card-codes(\/.*)?$/, key: PERMISSIONS.CARD_CODES_READ },
  { method: 'DELETE', pattern: /^\/api\/open\/card-codes(\/.*)?$/, key: PERMISSIONS.CARD_CODES_DELETE },
  { method: 'ANY', pattern: /^\/api\/open\/card-codes(\/.*)?$/, key: PERMISSIONS.CARD_CODES_WRITE },
  { method: 'POST', pattern: /^\/api\/open\/songs\/mark-played$/, key: PERMISSIONS.SONG_WRITE },
  { method: 'POST', pattern: /^\/api\/open\/songs\/request$/, key: PERMISSIONS.SONG_READ, note: '历史 songs:request 归并到 song.read（§5.1 / §8-③）' },
  { method: 'GET', pattern: /^\/api\/open\/songs(\/.*)?$/, key: PERMISSIONS.SONG_READ },
  { method: 'ANY', pattern: /^\/api\/open\/schedules(\/.*)?$/, key: PERMISSIONS.SCHEDULE_READ },
  { method: 'ANY', pattern: /^\/api\/open\/backup(\/.*)?$/, key: PERMISSIONS.BACKUP_EXECUTE }
])

/**
 * 免认证路由：本表不施加权限，认证由端点自身（登录/注册/预认证令牌）完成。
 * 顺序无关（逐一匹配），但只对 `/api/**` 生效。
 */
export const PUBLIC_ROUTE_PATTERNS: readonly RegExp[] = Object.freeze([
  /^\/api\/auth\//,
  /^\/api\/sys\/time$/,
  /^\/api\/site-config$/,
  /^\/api\/platform-config(\/.*)?$/,
  /^\/api\/legal-documents$/
])

/** 规范化路径：去查询串与尾部斜杠 */
export function normalizeRoutePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? pathname
  const trimmed = withoutQuery.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function matchRules(rules: readonly RouteRule[], method: string, path: string): RouteRule | null {
  const upper = method.toUpperCase()
  for (const rule of rules) {
    if (rule.method !== 'ANY' && rule.method !== upper) continue
    if (rule.pattern.test(path)) return rule
  }
  return null
}

/**
 * 单一权威判定入口（S3 接线、S5-4 中间件都走它）。
 * 未分类路径一律 `unmapped`（调用方按拒绝处理）。
 */
export function classifyApiRoute(method: string, pathname: string): RouteDecision {
  const path = normalizeRoutePath(pathname)

  const adminRule = matchRules(ROUTE_RULES, method, path)
  if (adminRule) {
    return { decision: 'permission', permission: adminRule.key, matched: `admin:${adminRule.key}` }
  }

  const openRule = matchRules(OPEN_ROUTE_RULES, method, path)
  if (openRule) {
    return { decision: 'permission', permission: openRule.key, matched: `open:${openRule.key}` }
  }

  if (PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(path))) {
    return { decision: 'public', permission: null, matched: 'public' }
  }

  // ⚠️ 管理域与开放 API 域**没有 login 兜底**：未注册 ⇒ unmapped（调用方拒绝）。
  // 否则新增的 admin 路由会退化成「任何登录用户可访问」，新增的 open 路由会被当会话路由处理。
  if (path.startsWith('/api/admin/') || path === '/api/admin' || path.startsWith('/api/open/')) {
    return { decision: 'unmapped', permission: null, matched: null }
  }

  if (path.startsWith('/api/')) {
    return { decision: 'login', permission: null, matched: 'login' }
  }

  return { decision: 'unmapped', permission: null, matched: null }
}

/** 便捷封装：需要权限时返回 key，否则 null */
export function resolveRoutePermission(method: string, pathname: string): PermissionKey | null {
  return classifyApiRoute(method, pathname).permission
}

/** 规则表自检（供契约检查与单测使用）：返回 catalog 之外的 key 列表 */
export function validateRouteRules(): string[] {
  const invalid: string[] = []
  for (const rule of [...ROUTE_RULES, ...OPEN_ROUTE_RULES]) {
    if (!isPermissionKey(rule.key)) invalid.push(`${rule.pattern.source} → ${String(rule.key)}`)
  }
  return invalid
}
