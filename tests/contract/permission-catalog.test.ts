/**
 * 权限目录冻结基线与 legacy 映射（S1-1 / S1-4 · D10 / R-32）。
 *
 * 与 `scripts/contract-checks/*.mjs` 的分工：
 *   - 契约检查（pnpm contract:check）= 结构 / 派生一致性，允许 catalog 有意演进；
 *   - 本测试 = **冻结数字**（35 项 / 矩阵 0/12/25/35 / legacy 8 条）与逐条硬编码期望，
 *     防止「catalog 整体漂移但自洽」的假绿。
 *
 * 若确需改变权限数量或矩阵，属于**有意契约变更**：必须同步本文件、seed 的冻结基线、
 * 以及 `planning/plan` 下的规划文档，并在 review 中显式说明。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LEGACY_PERMISSION_MAP,
  PERMISSION_KEYS,
  PERMISSION_LIST,
  ROLE_ORDER,
  ROLE_PERMISSIONS,
  ROLES,
  minRoleOf,
  normalizePermission
} from '../../shared/rbac/permission-catalog.js'

test('S1-1 冻结基线：catalog = 35 项，key 唯一且命名合规', () => {
  assert.equal(PERMISSION_LIST.length, 35)
  assert.equal(PERMISSION_KEYS.length, 35)
  assert.equal(new Set(PERMISSION_KEYS).size, 35)
  assert.equal(PERMISSION_LIST.every((definition) => Boolean(definition.minRole)), true)
})

test('S1-1 冻结基线：角色矩阵计数 = USER 0 / SONG_ADMIN 12 / ADMIN 25 / SUPER_ADMIN 35', () => {
  assert.deepEqual(ROLE_ORDER, [ROLES.USER, ROLES.SONG_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN])
  assert.deepEqual(
    ROLE_ORDER.map((role) => ROLE_PERMISSIONS[role].length),
    [0, 12, 25, 35]
  )
})

test('S1-1 裁决 D10：ADMIN 不含 permissions.read，SUPER_ADMIN 含', () => {
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes('permissions.read'), false)
  assert.equal(ROLE_PERMISSIONS.SUPER_ADMIN.includes('permissions.read'), true)
  assert.equal(minRoleOf('permissions.read'), ROLES.SUPER_ADMIN)
})

test('S1-1 legacy 冻结映射：8 条逐条硬编码（防「同源自洽」假绿）', () => {
  assert.equal(Object.keys(LEGACY_PERMISSION_MAP).length, 8)

  const expected = {
    'schedules:read': 'schedule.read',
    'songs:read': 'song.read',
    // 历史语义合并：点歌申请 songs:request → song.read（slice-plan §5.1 / §8-③）
    'songs:request': 'song.read',
    'songs:write': 'song.write',
    'card-codes:read': 'card_codes.read',
    'card-codes:write': 'card_codes.write',
    'card-codes:delete': 'card_codes.delete',
    'backup:execute': 'backup.execute'
  }

  for (const [legacy, key] of Object.entries(expected)) {
    assert.equal(LEGACY_PERMISSION_MAP[legacy], key, `legacy 映射值错误：${legacy}`)
    assert.equal(normalizePermission(legacy), key, `归一化结果错误：${legacy}`)
    assert.equal(PERMISSION_KEYS.includes(key), true, `映射目标不在 catalog：${key}`)
  }
})

test('S1-4 归一化拒绝近似 key（复数 / 连字符 / 大小写均不容错）', () => {
  for (const value of ['songs.read', 'song_read', 'song.READ', 'card_codes.read', 'card_codes:read']) {
    assert.equal(normalizePermission(value), null, `必须拒绝：${value}`)
  }
  assert.equal(normalizePermission('song.read'), 'song.read')
})
