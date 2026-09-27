/**
 * VoiceHub RBAC 权限目录 —— 全仓唯一权威定义（总纲 D4 / D11 / D19）
 *
 * 唯一性约束（R-32）：
 *   35 个权限 key、角色矩阵、legacy 映射只允许在本文件出现字面量。
 *   server / app / scripts / seed / normalize 一律 import 本模块或其薄 re-export
 *   （server/utils/rbac/constants.ts），禁止再抄第二份。
 *
 * 派生关系（D19，单向；任何一处都不允许反向手工维护）：
 *   PERMISSION_LIST 的 key + minRole
 *     ├─→ CATALOG            key → 权限定义（含 minRole）
 *     ├─→ PERMISSIONS        常量名（SONG_READ 等）→ key，常量名由 key 机械派生
 *     ├─→ PERMISSION_KEYS    35 个 key（目录顺序）
 *     ├─→ ROLE_PERMISSIONS   角色 → key 列表（角色强度 ≥ minRole 即拥有）
 *     └─→ LEGACY_MIN_ROLE    key → minRole（RBAC_ENABLED=false 的 legacy 回滚路径用）
 *
 * 命名规则（slice-plan §5.1 冻结）：key := resource "." action
 *   resource 小写、多词用下划线、一律单数（song.read / schedule.read / card_codes.read）；
 *   分隔符只能是 ASCII "."，禁止 ":" "-" 空格与大写。
 *
 * legacy 冒号词表 → catalog key（8 条，写入侧历史数据归一化用）：
 *   归一化目标必须逐字符等于 catalog 的 key。上一轮就是这里 7/8 写错
 *   （写成 songs.read / songs.write / card-codes.*），与运行时比对永不命中，
 *   导致历史 API Key 全量静默 403 —— 本文件是该事故的根因修复点。
 *   注意 songs:request 的历史语义是「点歌申请」，按 §5.1 / §8-③ 裁决合并到 song.read：
 *   因此 songs:request 与 songs:read 归一化后是同一个 key（不是漏配，也不是笔误）。
 *   如需恢复独立语义，必须新增 request.manage 并走契约变更，禁止在映射里临时造 key。
 */

/** 角色枚举 */
export const ROLES = Object.freeze({
  USER: 'USER',
  SONG_ADMIN: 'SONG_ADMIN',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
})

/** 角色强弱顺序（弱 → 强）：角色矩阵与 minRole 比较都以本数组为准 */
export const ROLE_ORDER = Object.freeze([
  ROLES.USER,
  ROLES.SONG_ADMIN,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
])

/** 角色强度数值：越大权限越广；未知角色无此表项，按不满足处理 */
export const ROLE_RANK = Object.freeze(
  Object.fromEntries(ROLE_ORDER.map((role, index) => [role, index]))
)

/** 个人加授 / 减授类型，对应 user_permissions.grant_type 的 CHECK 取值 */
export const GRANT_TYPES = Object.freeze({
  ASSIGN: 'assign',
  REVOKE: 'revoke'
})

/** 权限 key 命名正则（源串）：可直接 new RegExp(NAMING_RULE) 判定 */
export const NAMING_RULE =
  '^[a-z][a-z0-9_]*\\.(read|write|manage|execute|delete|publish|reject|status|send|reset|restore|export)$'

/** 目录版本，用于后续契约变更时对账 */
export const CATALOG_VERSION = 1

/**
 * 权限定义
 * @typedef {object} PermissionDefinition
 * @property {string} key 权限 key（resource.action）
 * @property {string} category 所属域
 * @property {string} zh 中文描述
 * @property {string} en 英文描述
 * @property {boolean} isApiPermission 是否可作为 API Key 权限
 * @property {string} minRole 拥有该权限的最低角色（ROLES.* 之一，D19）
 */

/**
 * 35 项权限定义（唯一一份 key 字面量）
 * minRole 口径：该 key 在角色矩阵中出现的最弱角色；USER 矩阵为空，故无 minRole=USER 的项。
 * @type {ReadonlyArray<PermissionDefinition>}
 */
export const PERMISSION_LIST = Object.freeze([
  // user 域
  {
    key: 'user.read',
    category: 'user',
    zh: '查看用户',
    en: 'View users',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'user.manage',
    category: 'user',
    zh: '管理用户（创建/修改/删除）',
    en: 'Manage users',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'user.status',
    category: 'user',
    zh: '调整用户状态',
    en: 'Change user status',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  // song 域
  {
    key: 'song.read',
    category: 'song',
    zh: '查看歌曲',
    en: 'View songs',
    isApiPermission: true,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'song.write',
    category: 'song',
    zh: '审核 / 处理歌曲',
    en: 'Process songs',
    isApiPermission: true,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'song.reject',
    category: 'song',
    zh: '拒绝投稿',
    en: 'Reject submissions',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  // schedule 域
  {
    key: 'schedule.read',
    category: 'schedule',
    zh: '查看排期',
    en: 'View schedules',
    isApiPermission: true,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'schedule.write',
    category: 'schedule',
    zh: '编辑排期',
    en: 'Edit schedules',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'schedule.publish',
    category: 'schedule',
    zh: '发布排期',
    en: 'Publish schedules',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  // playtimes / request_times / semester 域
  {
    key: 'playtimes.manage',
    category: 'playtimes',
    zh: '管理播出时段',
    en: 'Manage play times',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'request_times.manage',
    category: 'request_times',
    zh: '管理投稿时段',
    en: 'Manage request times',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'semester.manage',
    category: 'semester',
    zh: '管理学期',
    en: 'Manage semesters',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  // stats 域
  {
    key: 'stats.read',
    category: 'stats',
    zh: '查看数据统计',
    en: 'View statistics',
    isApiPermission: false,
    minRole: ROLES.SONG_ADMIN
  },
  // card_codes 域
  {
    key: 'card_codes.read',
    category: 'card_codes',
    zh: '查看卡密',
    en: 'View card codes',
    isApiPermission: true,
    minRole: ROLES.SONG_ADMIN
  },
  {
    key: 'card_codes.write',
    category: 'card_codes',
    zh: '生成 / 修改卡密',
    en: 'Create / modify card codes',
    isApiPermission: true,
    minRole: ROLES.SONG_ADMIN
  },
  // blacklist / system_settings / email_templates / smtp / grade_class 域
  {
    key: 'blacklist.manage',
    category: 'blacklist',
    zh: '管理黑名单',
    en: 'Manage blacklist',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'system_settings.read',
    category: 'system_settings',
    zh: '查看系统设置',
    en: 'View system settings',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'email_templates.manage',
    category: 'email_templates',
    zh: '管理邮件模板',
    en: 'Manage email templates',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'smtp.manage',
    category: 'smtp',
    zh: '管理 SMTP',
    en: 'Manage SMTP',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'grade_class.manage',
    category: 'grade_class',
    zh: '管理年级班级',
    en: 'Manage grade & class',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  // backup / database / notification 域
  {
    key: 'backup.execute',
    category: 'backup',
    zh: '执行备份',
    en: 'Execute backup',
    isApiPermission: true,
    minRole: ROLES.ADMIN
  },
  {
    key: 'notification.send',
    category: 'notification',
    zh: '发送系统通知',
    en: 'Send system notifications',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  // api_keys 域
  {
    key: 'api_keys.read',
    category: 'api_keys',
    zh: '查看 API Key',
    en: 'View API keys',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'api_keys.write',
    category: 'api_keys',
    zh: '创建 / 修改 API Key',
    en: 'Create / modify API keys',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  {
    key: 'api_keys.manage',
    category: 'api_keys',
    zh: '查看 API Key 统计与异常',
    en: 'View API key statistics',
    isApiPermission: false,
    minRole: ROLES.ADMIN
  },
  // 以下为 SUPER_ADMIN 增量（含 D10 裁决：ADMIN 不给 permissions.read）
  {
    key: 'system_settings.write',
    category: 'system_settings',
    zh: '修改系统设置',
    en: 'Modify system settings',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'backup.export',
    category: 'backup',
    zh: '导出备份',
    en: 'Export backup',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'backup.restore',
    category: 'backup',
    zh: '恢复备份',
    en: 'Restore backup',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'database.reset',
    category: 'database',
    zh: '重置数据库',
    en: 'Reset database',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'card_codes.delete',
    category: 'card_codes',
    zh: '删除卡密',
    en: 'Delete card codes',
    isApiPermission: true,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'api_keys.delete',
    category: 'api_keys',
    zh: '删除 API Key',
    en: 'Delete API keys',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  // rbac 域（仅 SUPER_ADMIN）
  {
    key: 'role.manage',
    category: 'rbac',
    zh: '管理角色权限矩阵',
    en: 'Manage role-permission matrix',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'user_permissions.manage',
    category: 'rbac',
    zh: '管理用户加授',
    en: 'Manage user permission grants',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'permissions.read',
    category: 'rbac',
    zh: '查看权限目录',
    en: 'View permission catalog',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  },
  {
    key: 'permissions.manage',
    category: 'rbac',
    zh: '管理权限目录',
    en: 'Manage permission catalog',
    isApiPermission: false,
    minRole: ROLES.SUPER_ADMIN
  }
])

// 载入即校验：目录数据坏了必须立刻失败，禁止静默降级（上一轮事故就是静默失效）
const namingPattern = new RegExp(NAMING_RULE)
const seenKeys = new Set()
for (const definition of PERMISSION_LIST) {
  if (seenKeys.has(definition.key)) {
    throw new Error(`[permission-catalog] 权限 key 重复：${definition.key}`)
  }
  seenKeys.add(definition.key)
  if (!namingPattern.test(definition.key)) {
    throw new Error(`[permission-catalog] 权限 key 命名不合规：${definition.key}`)
  }
  if (!ROLE_ORDER.includes(definition.minRole)) {
    throw new Error(`[permission-catalog] minRole 非法：${definition.key} → ${definition.minRole}`)
  }
  if (!definition.category || !definition.zh || !definition.en) {
    throw new Error(`[permission-catalog] 缺少 category 或描述：${definition.key}`)
  }
}

/** 权限 key 列表（目录顺序） */
export const PERMISSION_KEYS = Object.freeze(PERMISSION_LIST.map((definition) => definition.key))

/** 权限定义表：key → { key, category, zh, en, isApiPermission, minRole } */
export const CATALOG = Object.freeze(
  Object.fromEntries(
    PERMISSION_LIST.map((definition) => [definition.key, Object.freeze({ ...definition })])
  )
)

/** key → 常量名（song.read → SONG_READ）：机械派生，禁止另抄一份 */
function toConstantName(key) {
  return key.toUpperCase().replace(/\./g, '_')
}

/** 权限常量：常量名 → key（常量名由 key 派生，二者不可能漂移） */
export const PERMISSIONS = Object.freeze(
  Object.fromEntries(
    PERMISSION_LIST.map((definition) => [toConstantName(definition.key), definition.key])
  )
)

/**
 * 角色 → 权限 key 列表（D19 派生，非手工维护）
 * 角色拥有某权限 ⇔ 角色强度 ≥ 该权限的 minRole。
 */
export const ROLE_PERMISSIONS = Object.freeze(
  Object.fromEntries(
    ROLE_ORDER.map((role) => [
      role,
      Object.freeze(
        PERMISSION_LIST.filter(
          (definition) => ROLE_RANK[definition.minRole] <= ROLE_RANK[role]
        ).map((definition) => definition.key)
      )
    ])
  )
)

/** 可作为 API Key 权限的 key（写入侧枚举，派生） */
export const API_PERMISSION_KEYS = Object.freeze(
  PERMISSION_LIST.filter((definition) => definition.isApiPermission).map(
    (definition) => definition.key
  )
)

/**
 * 个人集成令牌的默认权限（历史语义「点歌申请」）。
 *
 * 按 §5.1 / §8-③ 裁决，`songs:request` 与 `songs:read` 归一化后同为 `song.read`；
 * 写这条常量是为了让「个人集成令牌用哪个权限」有唯一具名来源（`PERMISSIONS.SONG_READ` 是目标形态，
 * 本常量是其过渡期遗留写法），避免各端点各自硬编码冒号字符串。
 */
export const PERSONAL_INTEGRATION_LEGACY_PERMISSION = 'songs:request'

/**
 * 旧冒号风格 → catalog key（读取期归一化）
 * 值为 PERMISSIONS.* 引用而非点分字面量，key 改动时本表自动跟随。
 */
export const LEGACY_PERMISSION_MAP = Object.freeze({
  'schedules:read': PERMISSIONS.SCHEDULE_READ,
  'songs:read': PERMISSIONS.SONG_READ,
  // 历史语义合并：点歌申请（songs:request）→ song.read（§5.1 / §8-③ 裁决）
  [PERSONAL_INTEGRATION_LEGACY_PERMISSION]: PERMISSIONS.SONG_READ,
  'songs:write': PERMISSIONS.SONG_WRITE,
  'card-codes:read': PERMISSIONS.CARD_CODES_READ,
  'card-codes:write': PERMISSIONS.CARD_CODES_WRITE,
  'card-codes:delete': PERMISSIONS.CARD_CODES_DELETE,
  'backup:execute': PERMISSIONS.BACKUP_EXECUTE
})

/**
 * 权限 key → 最低所需角色（D19 派生）
 * legacyRoleCheck 的 RBAC_ENABLED=false 回滚路径以本表为准。
 */
export const LEGACY_MIN_ROLE = Object.freeze(
  Object.fromEntries(PERMISSION_LIST.map((definition) => [definition.key, definition.minRole]))
)

/** 取某权限的最低角色；未知 key 返回 null */
export function minRoleOf(key) {
  return CATALOG[key]?.minRole ?? null
}

/** 角色强度数值；未知角色返回 -1（一律视为不满足） */
export function roleRank(role) {
  return ROLE_RANK[role] ?? -1
}

/** 是否为 catalog 内的合法权限 key */
export function isPermissionKey(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATALOG, value)
}

/** 角色是否拥有某权限（未知角色、未知 key 一律 false） */
export function roleHasPermission(role, key) {
  const minRole = minRoleOf(key)
  if (!minRole) return false
  return roleRank(role) >= ROLE_RANK[minRole]
}

/**
 * 归一化权限 key：冒号（legacy）与点分（catalog）输入都返回 catalog key，未知返回 null。
 * 逐字符精确匹配，不做单复数 / 大小写 / 分隔符模糊容错 —— 上一轮 403 事故正是
 * 「看起来差不多」的 key 被当成同一项。
 */
export function normalizePermission(raw) {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (isPermissionKey(value)) return value
  return Object.prototype.hasOwnProperty.call(LEGACY_PERMISSION_MAP, value)
    ? LEGACY_PERMISSION_MAP[value]
    : null
}
