/**
 * 后台权限码目录与有效权限解析（唯一权威实现，前后端共用）。
 *
 * 码格式为 `域:动作`；`priv:` 是站点级能力，其余是业务域动作。
 * 通配符 `*` 与 `域:*`，`!` 前缀表示显式拒绝；判定顺序：显式拒绝 > 显式授予 > 角色模板。
 * 目录封闭：不在 ADMIN_PERMISSION_CODES 中的码（含通配形态）在归一化时丢弃。
 */

// 全站通配码：超级管理员模板使用，新增域自动放行
export const PERMISSION_ALL = '*'

// 站点级：进入后台控制台。所有 /api/admin 接口都先要求它，再要求域动作码
export const PRIV_ADMIN_CONSOLE = 'priv:admin-console'
// 站点级：编辑角色权限模板（权限矩阵页）
export const PRIV_ROLE_TEMPLATE = 'priv:role-template'
// 站点级：按用户显式授权/拒权
export const PRIV_GRANT = 'priv:grant'
// 站点级：管理员审计与日志管理，仅供超级管理员。不进入权限目录，无法被显式授出
export const PRIV_AUDIT = 'priv:audit'
export const PRIV_LOGS = 'priv:logs'

// 私有码只在持有全站通配 `*`（即超级管理员模板）时生效；
// `priv:*` 等域通配不得覆盖，避免把审计能力随通配授权扩散出去。
const PRIVATE_PERMISSION_CODES: ReadonlySet<string> = new Set([PRIV_AUDIT, PRIV_LOGS])

// 安全阀保护的站点级能力：移出其最后一个持有者会把站点锁死在无人可再授权的状态
export const PROTECTED_PRIV_CODES: readonly string[] = [
  PRIV_ADMIN_CONSOLE,
  PRIV_ROLE_TEMPLATE,
  PRIV_GRANT
]

// 角色分组：可进入后台的角色 / 管理员及以上的角色
export const ADMIN_CONSOLE_ROLES: readonly string[] = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']
export const MANAGER_ROLES: readonly string[] = ['ADMIN', 'SUPER_ADMIN']

// 受保护角色：仅现有超级管理员可授予或撤销，且必须通过二次验证
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN'

// 活跃超级管理员账号上限，防止全站权限被批量扩散
export const MAX_SUPER_ADMIN_ACCOUNTS = 3

// 权限码目录：与 server/utils/admin-permission-routes.ts 的接口守卫一一对应
export const ADMIN_PERMISSION_CODES: readonly string[] = [
  PRIV_ADMIN_CONSOLE,
  PRIV_ROLE_TEMPLATE,
  PRIV_GRANT,
  // 概览与内容
  'activities:read',
  'songs:read',
  'songs:write',
  'songs:review',
  'songs:delete',
  'songs:bypass-limits',
  'schedule:read',
  'schedule:write',
  'stats:read',
  'play-times:read',
  'play-times:write',
  'request-times:read',
  'request-times:write',
  'semesters:read',
  'semesters:write',
  'semesters:delete',
  'card-codes:read',
  'card-codes:write',
  'card-codes:assign',
  'card-codes:delete',
  'card-codes:bypass-disabled',
  'replay-requests:read',
  'replay-requests:write',
  // 人员
  'users:read',
  'users:write',
  'users:delete',
  'users:approve',
  'users:reset-password',
  'users:assign-role',
  'users:export',
  'users:read-songs',
  'grade-class:read',
  'grade-class:write',
  'grade-class:delete',
  'blacklist:read',
  'blacklist:write',
  'blacklist:delete',
  // 系统配置
  'system-settings:read',
  'system-settings:write',
  'system-settings:secrets',
  'notifications:read',
  'notifications:write',
  'notifications:delete',
  'smtp:read',
  'smtp:write',
  'smtp:test',
  'astrbot:read',
  'astrbot:write',
  'email-templates:read',
  'email-templates:write',
  'email-templates:delete',
  'system-board:read',
  'system-board:write',
  // 基础设施
  'api-keys:read',
  'api-keys:write',
  'backup:read',
  'backup:write',
  'backup:restore',
  'database:read',
  'database:maintenance',
  'database:reset',
  'system:read',
  'music-source:read',
  'music-source:write',
  'music-source-plugins:read',
  'music-source-plugins:write',
  // 页面码可单独显示入口；显式拒绝页面码可隐藏业务能力派生的入口。
  'page:overview',
  'page:schedule',
  'page:print',
  'page:songs',
  'page:data-analysis',
  'page:users',
  'page:grade-class',
  'page:api-keys',
  'page:notifications',
  'page:smtp-config',
  'page:playtimes',
  'page:request-times',
  'page:semesters',
  'page:blacklist',
  'page:card-codes',
  'page:music-source',
  'page:site-config',
  'page:database',
  'page:system-board',
  'page:permissions',
  'page:password'
]

const PERMISSION_CODE_SET: ReadonlySet<string> = new Set(ADMIN_PERMISSION_CODES)

// 由目录派生的合法通配形态：songs:*、priv:* 等
const DOMAIN_WILDCARD_SET: ReadonlySet<string> = new Set(
  ADMIN_PERMISSION_CODES.map((code) => `${code.split(':')[0]}:*`)
)

// 角色默认模板；页面入口由业务能力和页面码共同决定。
export const ROLE_PERMISSION_TEMPLATES_DEFAULT: Record<string, readonly string[]> = {
  USER: [],
  SONG_ADMIN: [
    PRIV_ADMIN_CONSOLE,
    'activities:read',
    'songs:read',
    'songs:write',
    'songs:review',
    'songs:delete',
    'songs:bypass-limits',
    'system:read',
    'schedule:read',
    'schedule:write',
    'stats:read',
    'play-times:read',
    'play-times:write',
    'request-times:read',
    'request-times:write',
    'semesters:read',
    'semesters:write',
    'semesters:delete',
    'card-codes:read',
    'card-codes:write',
    'card-codes:assign',
    'card-codes:delete',
    'replay-requests:read',
    'replay-requests:write',
    'users:read-songs',
    // 页面入口
    'page:overview',
    'page:schedule',
    'page:print',
    'page:songs',
    'page:data-analysis',
    'page:playtimes',
    'page:request-times',
    'page:semesters',
    'page:card-codes',
    'page:password'
  ],
  ADMIN: [
    PRIV_ADMIN_CONSOLE,
    'activities:read',
    'songs:read',
    'songs:write',
    'songs:review',
    'songs:delete',
    'songs:bypass-limits',
    'system:read',
    'schedule:read',
    'schedule:write',
    'stats:read',
    'play-times:read',
    'play-times:write',
    'request-times:read',
    'request-times:write',
    'semesters:read',
    'semesters:write',
    'semesters:delete',
    'card-codes:read',
    'card-codes:write',
    'card-codes:assign',
    'card-codes:delete',
    'replay-requests:read',
    'replay-requests:write',
    'users:read-songs',
    'users:read',
    'card-codes:bypass-disabled',
    'users:write',
    'users:delete',
    'users:approve',
    'users:reset-password',
    'users:assign-role',
    'users:export',
    'grade-class:read',
    'grade-class:write',
    'grade-class:delete',
    'blacklist:read',
    'blacklist:write',
    'blacklist:delete',
    'system-settings:read',
    'system-settings:write',
    'notifications:read',
    'notifications:write',
    'notifications:delete',
    'smtp:write',
    'smtp:test',
    'email-templates:read',
    'email-templates:write',
    'email-templates:delete',
    'database:read',
    'database:maintenance',
    'music-source:read',
    'music-source:write',
    // 页面入口：站点配置、通知、黑名单、数据库、API 密钥、系统看板不在普通管理员界面
    'page:overview',
    'page:schedule',
    'page:print',
    'page:songs',
    'page:data-analysis',
    'page:users',
    'page:grade-class',
    'page:playtimes',
    'page:request-times',
    'page:semesters',
    'page:card-codes',
    'page:music-source',
    'page:password'
  ],
  SUPER_ADMIN: [PERMISSION_ALL]
}

// 后台页面 ID（侧边栏与 dashboard tab 共用），页面码统一为 `page:<id>`
export const ADMIN_PAGE_IDS: readonly string[] = [
  'overview',
  'schedule',
  'print',
  'songs',
  'data-analysis',
  'users',
  'grade-class',
  'api-keys',
  'notifications',
  'smtp-config',
  'playtimes',
  'request-times',
  'semesters',
  'blacklist',
  'card-codes',
  'music-source',
  'site-config',
  'database',
  'system-board',
  'permissions',
  'password',
  'audit-log',
  'logs'
]

export const PAGE_PERMISSIONS: Record<string, readonly string[]> = Object.fromEntries(
  ADMIN_PAGE_IDS.map((page) => [page, [`page:${page}`]])
)

// 仅包含完成功能所需的数据读取，不隐含其他写入、凭据或站点级能力。
export const PERMISSION_READ_DEPENDENCIES: Record<string, readonly string[]> = {
  'songs:read': ['songs:write', 'songs:review', 'songs:delete', 'schedule:read', 'schedule:write'],
  'schedule:read': ['schedule:write'],
  'play-times:read': ['play-times:write'],
  'request-times:read': ['request-times:write'],
  'semesters:read': ['semesters:write', 'semesters:delete'],
  'card-codes:read': ['card-codes:write', 'card-codes:assign', 'card-codes:delete'],
  'replay-requests:read': ['replay-requests:write'],
  'users:read': ['users:write', 'users:delete', 'users:approve', 'users:reset-password', 'users:assign-role', 'users:export', PRIV_GRANT],
  'grade-class:read': ['grade-class:write', 'grade-class:delete'],
  'blacklist:read': ['blacklist:write', 'blacklist:delete'],
  'system-settings:read': ['system-settings:write', 'system-settings:secrets'],
  'notifications:read': ['notifications:write', 'notifications:delete'],
  'smtp:read': ['smtp:write', 'smtp:test'],
  'astrbot:read': ['astrbot:write'],
  'email-templates:read': ['email-templates:write', 'email-templates:delete'],
  'system-board:read': ['system-board:write'],
  'api-keys:read': ['api-keys:write'],
  'backup:read': ['backup:write'],
  'database:read': ['database:maintenance', 'database:reset'],
  'music-source:read': ['music-source:write'],
  'music-source-plugins:read': ['music-source-plugins:write']
}

export const ADMIN_PAGE_CAPABILITIES: Record<string, readonly string[]> = {
  overview: ['stats:read', 'activities:read', 'system:read'],
  schedule: ['schedule:read', 'replay-requests:read'],
  print: ['schedule:read'],
  songs: ['songs:read'],
  'data-analysis': ['stats:read'],
  users: ['users:read'],
  'grade-class': ['grade-class:read'],
  'api-keys': ['api-keys:read'],
  notifications: ['notifications:read'],
  'smtp-config': ['smtp:read', 'astrbot:read', 'email-templates:read'],
  playtimes: ['play-times:read'],
  'request-times': ['request-times:read'],
  semesters: ['semesters:read'],
  blacklist: ['blacklist:read'],
  'card-codes': ['card-codes:read'],
  'music-source': ['music-source:read', 'music-source-plugins:read', 'system-settings:read'],
  'site-config': ['system-settings:read'],
  database: ['database:read', 'backup:read', 'backup:restore'],
  'system-board': ['system-board:read'],
  permissions: [PRIV_ROLE_TEMPLATE],
  password: [],
  'audit-log': [PRIV_AUDIT],
  logs: [PRIV_LOGS]
}

function isPermissionToken(token: unknown): token is string {
  if (typeof token !== 'string' || !token) return false
  const body = token.startsWith('!') ? token.slice(1) : token
  if (!body) return false
  return body === PERMISSION_ALL || DOMAIN_WILDCARD_SET.has(body) || PERMISSION_CODE_SET.has(body)
}

// 供授权接口校验提交值：目录外的码要报错而不是静默丢弃
export function isValidPermissionToken(token: unknown): boolean {
  return isPermissionToken(token)
}

// 可配置权限模板的角色，顺序与展示顺序一致
export const ROLE_TEMPLATE_KEYS: readonly string[] = Object.keys(ROLE_PERMISSION_TEMPLATES_DEFAULT)

export const ROLE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/

export function isValidRoleKey(role: unknown): role is string {
  return typeof role === 'string' && ROLE_KEY_PATTERN.test(role)
}

export function getRoleTemplateKeys(templates?: Record<string, unknown> | null): string[] {
  const custom = templates && typeof templates === 'object' && !Array.isArray(templates)
    ? Object.keys(templates).filter((role) => isValidRoleKey(role))
    : []
  return [...new Set([...ROLE_TEMPLATE_KEYS, ...custom])]
}

// 把已归一化的码拆成显式授予与显式拒绝两组，供授权界面分栏展示
export function splitGrantTokens(tokens: unknown): { grants: string[]; denies: string[] } {
  const normalized = normalizePermissionTokens(tokens)
  return {
    grants: normalized.filter((token) => !token.startsWith('!')),
    denies: normalized.filter((token) => token.startsWith('!')).map((token) => token.slice(1))
  }
}

// 权限码按域分组（`priv:` 站点级能力在前），供权限矩阵展示
export function groupPermissionCodes(
  codes: readonly string[] = ADMIN_PERMISSION_CODES
): { domain: string; codes: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const code of codes) {
    const domain = code.split(':')[0]!
    const list = groups.get(domain)
    if (list) list.push(code)
    else groups.set(domain, [code])
  }
  return [...groups.entries()]
    .map(([domain, list]) => ({ domain, codes: list }))
    .sort((a, b) => {
      if (a.domain === 'priv') return -1
      if (b.domain === 'priv') return 1
      return codes.indexOf(`${a.domain}:read`) - codes.indexOf(`${b.domain}:read`)
    })
}

// 归一化：去重、剔除空值与目录外的码，保持原始顺序
export function normalizePermissionTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const token = item.trim()
    if (!token || !isPermissionToken(token) || seen.has(token)) continue
    seen.add(token)
    result.push(token)
  }
  return result
}

// users.permissions 为 NULL 时跟随角色模板
export function followsRoleTemplate(permissions: unknown): boolean {
  return permissions === null || permissions === undefined
}

// 模板缺失或非数组的角色回落到默认模板；显式配置为空数组表示该角色无码
export function resolveRoleTemplate(
  role: string | null | undefined,
  templates?: Record<string, unknown> | null
): string[] {
  if (!role) return []
  const configured = templates && typeof templates === 'object' ? templates[role] : undefined
  if (Array.isArray(configured)) return normalizePermissionTokens(configured)
  return [...(ROLE_PERMISSION_TEMPLATES_DEFAULT[role] ?? [])]
}

// 有效权限 = 角色模板 + 用户显式授予，显式拒绝在判定时优先
export function resolveEffectivePermissions(
  user: { role?: string | null; permissions?: unknown } | null | undefined,
  templates?: Record<string, unknown> | null
): string[] {
  if (!user) return []
  const template = resolveRoleTemplate(user.role, templates)
  if (followsRoleTemplate(user.permissions)) return template
  return [...new Set([...template, ...normalizePermissionTokens(user.permissions)])]
}

function matchesToken(token: string, code: string): boolean {
  if (token === PERMISSION_ALL) return true
  if (token.endsWith(':*')) return code.startsWith(token.slice(0, -1))
  return token === code
}

// 将一个授权令牌展开为权限目录中的具体权限码，供授权边界校验使用。
export function expandPermissionToken(
  token: string,
  codes: readonly string[] = ADMIN_PERMISSION_CODES
): string[] {
  const body = token.startsWith('!') ? token.slice(1) : token
  if (body === PERMISSION_ALL) return [...codes]
  if (body.endsWith(':*')) return codes.filter((code) => code.startsWith(body.slice(0, -1)))
  return codes.includes(body) ? [body] : []
}

// 只有操作者实际持有令牌覆盖的全部具体权限，才允许授出该令牌。
export function canGrantPermissionToken(
  token: string,
  operatorPerms: readonly string[],
  codes: readonly string[] = ADMIN_PERMISSION_CODES
): boolean {
  const body = token.startsWith('!') ? token.slice(1) : token
  if ((body === PERMISSION_ALL || body.endsWith(':*')) && !hasPermission(operatorPerms, body))
    return false
  const expanded = expandPermissionToken(token, codes)
  const required = new Set(expanded)
  let previousSize = 0
  while (previousSize !== required.size) {
    previousSize = required.size
    for (const [read, actions] of Object.entries(PERMISSION_READ_DEPENDENCIES)) {
      if (actions.some((code) => required.has(code))) required.add(read)
    }
  }
  return expanded.length > 0 && [...required].every((code) => hasPermission(operatorPerms, code))
}

export function hasAdminPermission(
  user: { perms?: readonly string[] } | null | undefined,
  code: string
): boolean {
  const perms = user?.perms ?? []
  return hasPermission(perms, PRIV_ADMIN_CONSOLE) && hasPermission(perms, code)
}

export function canAssignRole(
  user: { role?: string; perms?: readonly string[] } | null | undefined,
  role: string,
  availableRoles: readonly string[] = ROLE_TEMPLATE_KEYS
): boolean {
  if (!hasAdminPermission(user, 'users:assign-role') || !availableRoles.includes(role)) return false
  if (role === SUPER_ADMIN_ROLE) return user?.role === SUPER_ADMIN_ROLE
  return true
}

// 涉及超级管理员身份的授予或撤销；服务端与 UI 共用此判据决定是否要求二次验证
// 两端均可传 null：null 分别表示新建账号与账号退出（删除/不再是后台账号）
export function isSuperAdminRoleTransition(
  previousRole?: string | null,
  nextRole?: string | null
): boolean {
  if (previousRole === nextRole) return false
  return previousRole === SUPER_ADMIN_ROLE || nextRole === SUPER_ADMIN_ROLE
}

// 将用户级通配拒绝拆成具体拒绝，允许逐项恢复用户权限。
export function toggleExplicitPermission(
  template: readonly string[],
  explicit: readonly string[],
  code: string
): string[] {
  const granted = hasPermission([...template, ...explicit], code)
  let next = explicit.filter((token) => token !== code && token !== `!${code}`)
  if (!granted) {
    next = next.flatMap((token) =>
      token.startsWith('!') && expandPermissionToken(token).includes(code)
        ? expandPermissionToken(token)
            .filter((item) => item !== code)
            .map((item) => `!${item}`)
        : [token]
    )
  }
  const inherited = hasPermission([...template, ...next], code)
  if (granted) return inherited ? [...next, `!${code}`] : next
  return inherited ? next : [...next, code]
}

export function isPermissionDenied(perms: readonly string[], code: string): boolean {
  return (
    Array.isArray(perms) &&
    perms.some((token) => token.startsWith('!') && matchesToken(token.slice(1), code))
  )
}

export function hasPermission(perms: readonly string[], code: string): boolean {
  if (!Array.isArray(perms) || !code) return false
  if (isPermissionDenied(perms, code)) return false
  if (PRIVATE_PERMISSION_CODES.has(code)) return perms.includes(PERMISSION_ALL)
  const dependencies = PERMISSION_READ_DEPENDENCIES[code]
  return perms.some((token) => !token.startsWith('!') && matchesToken(token, code)) ||
    (Array.isArray(dependencies) && dependencies.some((action) => hasPermission(perms, action)))
}

export function hasAnyPermission(perms: readonly string[], codes: readonly string[]): boolean {
  if (!codes.length) return true
  return codes.some((code) => hasPermission(perms, code))
}

export function hasAllPermissions(perms: readonly string[], codes: readonly string[]): boolean {
  return codes.every((code) => hasPermission(perms, code))
}

export function canAccessAdminConsole(perms: readonly string[]): boolean {
  return hasPermission(perms, PRIV_ADMIN_CONSOLE)
}

export function canAccessAdminPage(perms: readonly string[], page: string): boolean {
  const codes = PAGE_PERMISSIONS[page]
  if (!Array.isArray(codes) || !canAccessAdminConsole(perms) || isPermissionDenied(perms, `page:${page}`)) return false
  return hasAnyPermission(perms, codes) ||
    (ADMIN_PAGE_CAPABILITIES[page]?.some((code) => hasPermission(perms, code)) ?? false)
}

export function canUseAdminPage(perms: readonly string[], page: string): boolean {
  const capabilities = ADMIN_PAGE_CAPABILITIES[page]
  return canAccessAdminPage(perms, page) && !!capabilities && hasAnyPermission(perms, capabilities)
}

// 有效权限可访问的后台页面 ID，顺序与 ADMIN_PAGE_IDS 一致
export function accessiblePages(perms: readonly string[]): string[] {
  return ADMIN_PAGE_IDS.filter((page) => canAccessAdminPage(perms, page))
}
