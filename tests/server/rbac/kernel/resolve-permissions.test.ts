/**
 * S2-1 单测：权限解析的纯合并逻辑（无 DB）。
 *
 * 覆盖：角色矩阵 ∪ 加授 − 减授、revoke 优先、未知 key 不入集合（上一轮静默收集合的修复）、
 * legacy 冒号归一化、seed 未就位（空矩阵）⇒ degraded。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergePermissionState,
  normalizePermissionKeys
} from '../../../../server/utils/rbac/resolvePermissions.ts'

test('S2-1 合并：角色矩阵 ∪ 加授 − 减授', () => {
  const state = mergePermissionState({
    roleKeys: ['song.read', 'song.write'],
    grants: [
      { key: 'user.manage', grantType: 'assign' },
      { key: 'song.write', grantType: 'revoke' }
    ],
    matrixRowCount: 30
  })

  assert.deepEqual([...state.permissions].sort(), ['song.read', 'user.manage'])
  assert.equal(state.degraded, false)
  assert.equal(state.degradedReason, null)
  assert.deepEqual(state.unknownKeys, [])
})

test('S2-1 revoke 优先：同一 key 同时 assign 与 revoke 时以 revoke 为准', () => {
  const state = mergePermissionState({
    roleKeys: ['song.read'],
    grants: [
      { key: 'song.read', grantType: 'assign' },
      { key: 'song.read', grantType: 'revoke' }
    ],
    matrixRowCount: 5
  })

  assert.deepEqual([...state.permissions], [])
})

test('S2-1 未知 key 不得静默入集合（上一轮 403 事故的同源缺陷）', () => {
  const state = mergePermissionState({
    roleKeys: ['song.read', 'songs.read', 'song_read', 'Song.read'],
    grants: [
      { key: 'cards:read', grantType: 'assign' },
      { key: 'song.read.all', grantType: 'assign' }
    ],
    matrixRowCount: 1
  })

  assert.deepEqual([...state.permissions], ['song.read'])
  assert.deepEqual(
    [...state.unknownKeys].sort(),
    ['Song.read', 'cards:read', 'song.read.all', 'song_read', 'songs.read'].sort()
  )
})

test('S2-1 legacy 冒号映射：读取期归一化到 catalog key', () => {
  const state = mergePermissionState({
    roleKeys: ['songs:read', 'schedules:read'],
    grants: [
      { key: 'card-codes:delete', grantType: 'assign' },
      { key: 'songs:request', grantType: 'assign' }
    ],
    matrixRowCount: 10
  })

  assert.deepEqual([...state.permissions].sort(), ['card_codes.delete', 'schedule.read', 'song.read'])
  assert.deepEqual(state.unknownKeys, [])
})

test('S2-1 seed 未就位（role_permissions 为空）⇒ degraded', () => {
  const state = mergePermissionState({ roleKeys: [], grants: [], matrixRowCount: 0 })

  assert.equal(state.degraded, true)
  assert.match(state.degradedReason ?? '', /role_permissions 表为空/)
  assert.deepEqual([...state.permissions], [])
})

test('S2-1 normalizePermissionKeys：已归一化 key 原样返回，未知单列', () => {
  const result = normalizePermissionKeys(['song.read', ' song.read ', 'songs.read', 'backup:execute'])

  assert.deepEqual(result.keys, ['song.read', 'song.read', 'backup.execute'])
  assert.deepEqual(result.unknown, ['songs.read'])
})
