/**
 * 契约检查 · catalog 的消费面（S1-6 · R-32 / D4）。
 *
 * 覆盖三件事：
 *   1. API 权限枚举与 legacy 映射目标一致（上一轮 403 事故的同源风险）；
 *   2. `server/utils/rbac/constants.ts` 必须是纯 re-export（零 key 字面量 + 7 个冻结导出名）；
 *   3. 查询函数对未知 key / 未知角色的边界行为（未知一律拒绝，禁止 fail-open）。
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {
  API_PERMISSION_KEYS,
  LEGACY_PERMISSION_MAP,
  PERMISSION_KEYS,
  PERMISSION_LIST,
  isPermissionKey,
  minRoleOf,
  roleHasPermission,
  roleRank
} from '../../shared/rbac/permission-catalog.js'

const ROOT = process.cwd()

function checkApiPermissions() {
  const derived = PERMISSION_LIST.filter((definition) => definition.isApiPermission).map(
    (definition) => definition.key
  )
  assert.deepEqual([...API_PERMISSION_KEYS], derived, 'API 权限枚举与 isApiPermission 标记不一致')

  // legacy 映射目标必须是 API 权限，否则历史 API Key 归一化后仍然不可用
  const legacyTargets = [...new Set(Object.values(LEGACY_PERMISSION_MAP))]
  const notApi = legacyTargets.filter((key) => !API_PERMISSION_KEYS.includes(key))
  assert.equal(notApi.length, 0, `legacy 映射目标不是 API 权限：${notApi.join(', ')}`)
}

function checkConstantsReexport() {
  const constantsPath = path.join(ROOT, 'server', 'utils', 'rbac', 'constants.ts')
  const source = fs.readFileSync(constantsPath, 'utf8')

  const literals = source.match(/['"`][a-z][a-z0-9_]*\.[a-z]+['"`]/g)
  assert.equal(
    literals,
    null,
    `constants.ts 出现权限 key 字面量（应为纯 re-export）：${literals ? literals.join(', ') : ''}`
  )

  const frozenExports = [
    'PERMISSIONS',
    'ROLES',
    'PermissionKey',
    'LEGACY_PERMISSION_MAP',
    'GRANT_TYPES',
    'Role',
    'GrantType'
  ]
  const missing = frozenExports.filter((name) => !source.includes(name))
  assert.equal(missing.length, 0, `冻结导出名缺失：${missing.join(', ')}`)
}

function checkQueryHelpers() {
  assert.equal(isPermissionKey('song.read'), true, '合法 key 被拒')
  assert.equal(isPermissionKey('songs.read'), false, '近似 key（复数）必须拒绝 —— 上一轮 403 事故的根因')
  assert.equal(isPermissionKey(''), false, '空串必须拒绝')
  assert.equal(isPermissionKey(null), false, 'null 必须拒绝')
  assert.equal(minRoleOf('songs.read'), null, '未知 key 的 minRole 必须为 null')
  assert.equal(roleRank('NOT_A_ROLE'), -1, '未知角色 rank 必须为 -1')
  assert.equal(roleHasPermission('USER', PERMISSION_KEYS[0]), false, 'USER 不应拥有任何 catalog 权限')
  assert.equal(roleHasPermission('SUPER_ADMIN', PERMISSION_KEYS[0]), true, 'SUPER_ADMIN 必须拥有全部权限')
  assert.equal(roleHasPermission('SUPER_ADMIN', 'songs.read'), false, '未知 key 一律拒绝')
}

export const checks = [
  { name: 'API 权限枚举与 legacy 映射目标一致', run: checkApiPermissions },
  { name: 'constants.ts 仅做 re-export：零 key 字面量 + 7 个冻结导出名', run: checkConstantsReexport },
  { name: '查询函数边界：未知 key / 未知角色一律拒绝', run: checkQueryHelpers }
]
