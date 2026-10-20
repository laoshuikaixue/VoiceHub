import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN_PERMISSION_CODES,
  ROLE_PERMISSION_CODES,
  SONG_ADMIN_GRANTABLE_PERMISSION_CODES,
  SYSTEM_ADMIN_PERMISSION_CODES,
  normalizePermissionCodes,
  resolveEffectivePermissions
} from '../../app/utils/adminPermissions.ts'

test('歌曲管理员默认权限包含本职项且不含时段与排期写权限', () => {
  const codes = resolveEffectivePermissions({ role: 'SONG_ADMIN', permissions: [] })
  assert.ok(codes.includes('songs:review'))
  assert.ok(codes.includes('card-codes:write'))
  assert.ok(!codes.includes('play-times:write'))
  assert.ok(!codes.includes('request-times:write'))
  assert.ok(!codes.includes('semester:write'))
  assert.ok(!codes.includes('schedule:write'))
  assert.ok(!codes.includes('user:manage'))
})

test('额外授权并入生效权限，未知码与角色默认项被忽略', () => {
  const codes = resolveEffectivePermissions({
    role: 'SONG_ADMIN',
    permissions: ['play-times:write', 'user:manage', 'nope', 'songs:review']
  })
  assert.ok(codes.includes('play-times:write'))
  assert.ok(!codes.includes('user:manage'))
  assert.equal(codes.filter((code) => code === 'songs:review').length, 1)
})

test('普通用户与非配置角色忽略存储的授权', () => {
  assert.deepEqual(resolveEffectivePermissions({ role: 'USER', permissions: ['play-times:write'] }), [])
  assert.deepEqual(
    resolveEffectivePermissions({ role: 'ADMIN', permissions: ['play-times:write'] }),
    [...ADMIN_PERMISSION_CODES]
  )
})

test('写入前裁剪：只保留歌曲管理员可授予档位', () => {
  const grant = normalizePermissionCodes(
    ['play-times:write', 'user:manage', 'card-codes:write', 'unknown'],
    { role: 'SONG_ADMIN' }
  )
  assert.deepEqual(grant, ['play-times:write'])
})

test('角色变更后旧授权按新角色裁剪，非歌曲管理员清空', () => {
  assert.deepEqual(normalizePermissionCodes(['play-times:write'], { role: 'ADMIN' }), [])
  assert.deepEqual(normalizePermissionCodes(['play-times:write'], { role: 'USER' }), [])
})

test('可授予档位必须是权限码子集', () => {
  for (const code of SONG_ADMIN_GRANTABLE_PERMISSION_CODES) {
    assert.ok(ADMIN_PERMISSION_CODES.includes(code as (typeof ADMIN_PERMISSION_CODES)[number]))
  }
})

test('可授予档位不与歌曲管理员默认权限重叠', () => {
  const defaults = resolveEffectivePermissions({ role: 'SONG_ADMIN', permissions: [] })
  for (const code of SONG_ADMIN_GRANTABLE_PERMISSION_CODES) {
    assert.ok(!defaults.includes(code), `${code} 已是默认权限，不应出现在可授予档位`)
  }
})

test('权限码被三类档位完整覆盖，新增权限码不会漏归属', () => {
  const covered = new Set<string>([
    ...(ROLE_PERMISSION_CODES.SONG_ADMIN || []),
    ...SONG_ADMIN_GRANTABLE_PERMISSION_CODES,
    ...SYSTEM_ADMIN_PERMISSION_CODES
  ])
  assert.deepEqual(ADMIN_PERMISSION_CODES.filter((code) => !covered.has(code)), [])
})
