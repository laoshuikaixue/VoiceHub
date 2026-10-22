/**
 * S3-B3-1 验收测试：songs 域接线（admin 6 + 用户域 8 文件）。
 *
 * 重点：
 *   1. **§3.9 漂移回修**：`songs/add.post.ts` 必须放行 SONG_ADMIN（`song.write` 的 minRole），
 *      旧实现（以及上一轮 PR）把它收紧成 ADMIN 会切断歌曲管理员的投稿能力；
 *   2. `admin/songs/*` 走 song 权限（reject → `song.reject`，其余 → `song.write`）；
 *   3. 用户域里**确有门槛**的 3 条路由（`songs/:id/update`、`songs/:id/voters`、`songs/add`）
 *      与 routePermissionMap 的登记值一致；
 *   4. 静态接线：零角色名比较 / 零角色字面量数组，且软 admin 标记改用 `isSongAdminRole`。
 */

import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { resolveRoutePermission } from '../../../../server/utils/rbac/routePermissionMap.ts'
import { isSongAdminRole } from '../../../../server/utils/rbac/guards.ts'
import { ROLE_PERMISSIONS } from '../../../../server/utils/rbac/constants.ts'

const ROOT = process.cwd()

/** 本片接线的文件 → 期望策略调用（前 6 个是 admin/songs，后 3 个是用户域硬门槛，最后是软标记文件） */
const SONGS_FILES: Array<{ file: string; policy: string }> = [
  { file: 'server/api/admin/songs/batch-reject.post.ts', policy: 'canRejectSongs' },
  { file: 'server/api/admin/songs/reject.post.ts', policy: 'canRejectSongs' },
  { file: 'server/api/admin/songs/cover.post.ts', policy: 'canWriteSongs' },
  { file: 'server/api/admin/songs/duration.post.ts', policy: 'canWriteSongs' },
  { file: 'server/api/admin/songs/delete.post.ts', policy: 'canWriteSongs' },
  { file: 'server/api/admin/songs/mark-played.post.ts', policy: 'canWriteSongs' },
  { file: 'server/api/songs/[id]/update.put.ts', policy: 'canWriteSongs' },
  { file: 'server/api/songs/[id]/voters.get.ts', policy: 'canReadSongs' },
  { file: 'server/api/songs/add.post.ts', policy: 'canWriteSongs' }
]

const SOFT_FLAG_FILES = [
  'server/api/songs/check-restriction.post.ts',
  'server/api/songs/submission-status.get.ts',
  'server/api/songs/index.get.ts',
  'server/api/songs/public.get.ts',
  'server/api/songs/withdraw.post.ts'
]

test('S3-B3-1 §3.9 漂移回修：songs/add 放行 SONG_ADMIN（song.write 的 minRole = SONG_ADMIN）', () => {
  assert.equal(ROLE_PERMISSIONS.SONG_ADMIN.includes('song.write'), true, 'song.write 必须属于 SONG_ADMIN')
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes('song.write'), true, 'ADMIN 也应包含 song.write')
  assert.equal(ROLE_PERMISSIONS.SONG_ADMIN.includes('song.read'), true, 'song.read 必须属于 SONG_ADMIN')
  assert.equal(ROLE_PERMISSIONS.USER.includes('song.write'), false, '学生用户不得拥有 song.write')
})

test('S3-B3-1 admin/songs 走 song 权限：reject → song.reject，其余 → song.write', () => {
  assert.equal(resolveRoutePermission('POST', '/api/admin/songs/reject'), 'song.reject')
  assert.equal(resolveRoutePermission('POST', '/api/admin/songs/batch-reject'), 'song.reject')
  assert.equal(resolveRoutePermission('POST', '/api/admin/songs/delete'), 'song.write')
  assert.equal(resolveRoutePermission('POST', '/api/admin/songs/mark-played'), 'song.write')
  assert.equal(resolveRoutePermission('POST', '/api/admin/songs/cover'), 'song.write')
  assert.equal(resolveRoutePermission('POST', '/api/admin/songs/duration'), 'song.write')
})

test('S3-B3-1 用户域 3 条有门槛路由与 routePermissionMap 一致', () => {
  assert.equal(resolveRoutePermission('PUT', '/api/songs/12/update'), 'song.write')
  assert.equal(resolveRoutePermission('GET', '/api/songs/12/voters'), 'song.read')
  assert.equal(resolveRoutePermission('POST', '/api/songs/add'), 'song.write')
})

test('S3-B3-1 静态接线：9 个门槛文件接入策略，5 个软标记文件改用 isSongAdminRole', () => {
  for (const item of SONGS_FILES) {
    const text = fs.readFileSync(path.join(ROOT, item.file), 'utf8')
    assert.ok(text.includes(item.policy), `${item.file} 未接入 ${item.policy}`)
    assert.equal(
      /\.role\s*(===|!==)\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'/.test(text),
      false,
      `${item.file} 仍有角色名比较`
    )
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${item.file} 仍有角色字面量数组`
    )
  }

  for (const file of SOFT_FLAG_FILES) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
    assert.ok(text.includes('isSongAdminRole('), `${file} 软 admin 标记未改用 isSongAdminRole`)
    assert.equal(
      /\[\s*'(USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)'[^\]]*\]\s*\.includes\(/.test(text),
      false,
      `${file} 仍有角色字面量数组`
    )
  }
})

test('S3-B3-1 isSongAdminRole：SONG_ADMIN 及以上为真（等价旧数组判定）', () => {
  assert.equal(isSongAdminRole({ role: 'SONG_ADMIN' }), true)
  assert.equal(isSongAdminRole({ role: 'ADMIN' }), true)
  assert.equal(isSongAdminRole({ role: 'SUPER_ADMIN' }), true)
  assert.equal(isSongAdminRole({ role: 'USER' }), false)
  assert.equal(isSongAdminRole(null), false)
})

test('S3-B3-1 requireSongAdmin 调用点：本片范围内归零（仅剩 schedule 域 5 处）', () => {
  let output = ''
  try {
    output = execSync('git grep -l "requireSongAdmin(" -- server/api/admin/songs server/api/songs', {
      cwd: ROOT,
      encoding: 'utf8'
    }).trim()
  } catch {
    // git grep 无匹配时退出码非零 —— 那正是期望结果
    output = ''
  }
  assert.equal(output, '', `songs 域仍有 requireSongAdmin 调用点：${output}`)
})
