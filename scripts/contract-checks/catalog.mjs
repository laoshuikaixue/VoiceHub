/**
 * 契约检查 · catalog 结构与派生一致性（S1-6 · R-32 / R-41 / D4）。
 *
 * 跑器：`node scripts/check-permission-contract.mjs`（`pnpm contract:check` / `pnpm gate` 的 contract 步）。
 * 模块契约：`export const checks = [{ name, run }]`，run 抛错即失败。
 *
 * 只做结构 / 派生校验——允许 catalog 有意新增权限，但不允许任何自相矛盾。
 * 冻结数字（35 项 / 0/12/25/35）由 `tests/contract/permission-catalog.test.ts` 断言。
 */

import assert from 'node:assert/strict'
import {
  CATALOG,
  LEGACY_MIN_ROLE,
  NAMING_RULE,
  PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSION_LIST,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  ROLES,
  isPermissionKey,
  minRoleOf,
  roleRank
} from '../../shared/rbac/permission-catalog.js'

/** key → 常量名：与 catalog 内 toConstantName 同一规则（此处独立重算，避免同源假绿） */
const toConstantName = (key) => key.toUpperCase().replace(/\./g, '_')

function checkStructure() {
  const errors = []
  const seen = new Set()
  const namingPattern = new RegExp(NAMING_RULE)

  for (const definition of PERMISSION_LIST) {
    if (seen.has(definition.key)) errors.push(`重复 key：${definition.key}`)
    seen.add(definition.key)
    if (!namingPattern.test(definition.key)) errors.push(`命名不合规：${definition.key}`)
    if (!ROLE_ORDER.includes(definition.minRole)) {
      errors.push(`minRole 非法：${definition.key} → ${definition.minRole}`)
    }
    if (!definition.category || !definition.zh || !definition.en) {
      errors.push(`缺少 category / 双语描述：${definition.key}`)
    }
    if (typeof definition.isApiPermission !== 'boolean') {
      errors.push(`isApiPermission 非布尔：${definition.key}`)
    }
  }

  if (PERMISSION_KEYS.length !== PERMISSION_LIST.length) errors.push('PERMISSION_KEYS 与目录长度不一致')
  if (new Set(PERMISSION_KEYS).size !== PERMISSION_KEYS.length) errors.push('PERMISSION_KEYS 存在重复')
  if (Object.keys(CATALOG).length !== PERMISSION_LIST.length) errors.push('CATALOG 条目数与目录不一致')

  assert.equal(errors.length, 0, errors.join('；'))
}

function checkMatrix() {
  const errors = []

  for (const role of ROLE_ORDER) {
    const granted = ROLE_PERMISSIONS[role]
    for (const definition of PERMISSION_LIST) {
      const expected = roleRank(definition.minRole) <= roleRank(role)
      const actual = granted.includes(definition.key)
      if (expected !== actual) {
        errors.push(
          `${role} × ${definition.key}：期望 ${expected ? '有' : '无'}（minRole=${definition.minRole}），实际 ${actual ? '有' : '无'}`
        )
      }
    }
  }

  for (const role of Object.keys(ROLE_PERMISSIONS)) {
    if (!ROLE_ORDER.includes(role)) errors.push(`矩阵存在未知角色：${role}`)
    for (const key of ROLE_PERMISSIONS[role]) {
      if (!isPermissionKey(key)) errors.push(`矩阵引用了 catalog 之外的 key：${role} → ${key}`)
    }
  }

  assert.equal(errors.length, 0, errors.join('；'))
}

function checkDerived() {
  const errors = []

  for (const definition of PERMISSION_LIST) {
    if (LEGACY_MIN_ROLE[definition.key] !== definition.minRole) {
      errors.push(`LEGACY_MIN_ROLE 漂移：${definition.key}`)
    }
    if (CATALOG[definition.key].minRole !== definition.minRole) {
      errors.push(`CATALOG 与目录定义漂移：${definition.key}`)
    }
    if (PERMISSIONS[toConstantName(definition.key)] !== definition.key) {
      errors.push(`PERMISSIONS 常量名漂移：${definition.key} → ${toConstantName(definition.key)}`)
    }
  }

  if (Object.keys(PERMISSIONS).length !== PERMISSION_LIST.length) {
    errors.push(`PERMISSIONS 条目数 ${Object.keys(PERMISSIONS).length} != 目录 ${PERMISSION_LIST.length}`)
  }
  if (Object.keys(LEGACY_MIN_ROLE).length !== PERMISSION_LIST.length) {
    errors.push('LEGACY_MIN_ROLE 条目数与目录不一致')
  }

  assert.equal(errors.length, 0, errors.join('；'))
}

function checkD10() {
  // D10 裁决：ADMIN 不给 permissions.read —— 「权限总览」Tab 与读接口都靠它收口
  assert.equal(
    ROLE_PERMISSIONS.ADMIN.includes('permissions.read'),
    false,
    'D10 被破坏：ADMIN 拿到了 permissions.read'
  )
  assert.equal(
    ROLE_PERMISSIONS.SUPER_ADMIN.includes('permissions.read'),
    true,
    'SUPER_ADMIN 必须拥有 permissions.read'
  )
  assert.equal(minRoleOf('permissions.read'), ROLES.SUPER_ADMIN, 'permissions.read 的 minRole 必须是 SUPER_ADMIN')
}

export const checks = [
  { name: 'catalog 结构：key 唯一 / 命名合规 / minRole 合法 / 描述齐全', run: checkStructure },
  { name: 'catalog 派生：角色矩阵 == minRole 派生结果（逐条双向比对）', run: checkMatrix },
  { name: 'catalog 派生：LEGACY_MIN_ROLE 与 PERMISSIONS 常量名由 key 机械派生', run: checkDerived },
  { name: '裁决 D10：ADMIN 不含 permissions.read，且其 minRole = SUPER_ADMIN', run: checkD10 }
]
