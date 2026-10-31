import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import test from 'node:test'
import {
  ADMIN_PAGE_IDS,
  ADMIN_PERMISSION_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  accessiblePages,
  hasAllPermissions,
  hasAnyPermission,
  normalizePermissionTokens,
  resolveEffectivePermissions,
  resolveRoleTemplate,
  hasPermission,
  PRIV_ADMIN_CONSOLE
} from '../../app/utils/admin-permissions.ts'
import {
  ADMIN_ROUTE_RULES,
  resolveAdminRouteGuard
} from '../../server/utils/admin-permission-routes.ts'

const ADMIN_API_DIR = new URL('../../server/api/admin/', import.meta.url)
const ROLES = ['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'] as const
const ALL_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const SUPER = ['SUPER_ADMIN']
const MANAGER = ['ADMIN', 'SUPER_ADMIN']
const CONSOLE = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']

function endpointFiles(dir: URL, base = ''): string[] {
  const localDir = decodeURIComponent(dir.pathname)
  const found: string[] = []
  for (const name of readdirSync(localDir)) {
    const abs = `${localDir}/${name}`
    const rel = base ? `${base}/${name}` : name
    if (statSync(abs).isDirectory()) {
      found.push(...endpointFiles(new URL(`file://${abs}`), rel))
    } else if (name.endsWith('.ts') && readFileSync(abs, 'utf8').includes('export default defineEventHandler')) {
      found.push(rel)
    }
  }
  return found
}

// 重构前每个端点的放行角色集合，冻结在夹具里（端点源码的内联判定已被删除，无法再从源码推导）
interface BaselineEntry {
  file: string
  roles: string[]
}
const BASELINE = JSON.parse(
  readFileSync(new URL('../fixtures/admin-endpoint-roles.json', import.meta.url), 'utf8')
).endpoints as Record<string, BaselineEntry>

function toPathname(rel: string): { pathname: string; methods: readonly string[] } {
  const suffixMatch = rel.match(/\.(get|post|put|patch|delete)\.ts$/)
  const methods = suffixMatch ? [suffixMatch[1].toUpperCase()] : ALL_METHODS
  const withoutExt = rel.replace(/\.(get|post|put|patch|delete)\.ts$/, '.ts').replace(/\.ts$/, '')
  const segments = withoutExt
    .split('/')
    .filter((segment, index) => !(segment === 'index' && index > 0))
    .map((segment) => segment.replace(/\[[^\]]+\]/g, '42'))
  return { pathname: `/api/admin/${segments.join('/')}`, methods }
}

function allowedRoles(pathname: string, method: string): string[] {
  const guard = resolveAdminRouteGuard(pathname, method)
  if (!guard) return [...ROLES]
  if (guard.deny) return []
  return ROLES.filter((role) => {
    const perms = resolveEffectivePermissions({ role }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
    return hasAllPermissions(perms, guard.all) && hasAnyPermission(perms, guard.any)
  })
}

test('守卫表逐端点还原夹具冻结的重构前角色结论', () => {
  const keys = Object.keys(BASELINE)
  // 夹具异常或端点大幅减少时禁止空跑通过
  assert.ok(keys.length > 100, `基线夹具条目异常: ${keys.length}`)

  const mismatches: string[] = []
  for (const [key, entry] of Object.entries(BASELINE)) {
    const separator = key.indexOf(' ')
    const method = key.slice(0, separator)
    const pathname = key.slice(separator + 1)
    const actual = allowedRoles(pathname, method)
    if (actual.join(',') !== entry.roles.join(',')) {
      mismatches.push(`${key} (${entry.file}) 期望 ${entry.roles.join('|')} 实际 ${actual.join('|') || '无'}`)
    }
  }
  assert.deepEqual(mismatches, [], `后台守卫表与基线夹具不一致:\n${mismatches.join('\n')}`)
})

test('每个现存后台端点的每个方法都由守卫表显式登记，不依赖退化规则', () => {
  const files = endpointFiles(ADMIN_API_DIR)
  assert.ok(files.length > 100, `后台端点扫描异常: ${files.length}`)

  const unregistered: string[] = []
  for (const rel of files) {
    const { pathname, methods } = toPathname(rel)
    for (const method of methods) {
      const guard = resolveAdminRouteGuard(pathname, method)
      if (!guard || guard.fallback) unregistered.push(`${method} ${pathname} (${rel})`)
    }
  }
  assert.deepEqual(unregistered, [], `存在未登记的后台端点方法:\n${unregistered.join('\n')}`)
})

test('守卫表引用的权限码都在目录内，模板码同样受目录约束', () => {
  const unknown: string[] = []
  for (const rule of ADMIN_ROUTE_RULES) {
    for (const code of rule.any) {
      if (!ADMIN_PERMISSION_CODES.includes(code)) unknown.push(`${rule.p} → ${code}`)
    }
  }
  for (const [role, codes] of Object.entries(ROLE_PERMISSION_TEMPLATES_DEFAULT)) {
    for (const token of codes) {
      const body = token.startsWith('!') ? token.slice(1) : token
      if (body !== '*' && !body.endsWith(':*') && !ADMIN_PERMISSION_CODES.includes(body)) {
        unknown.push(`模板 ${role} → ${token}`)
      }
    }
  }
  assert.deepEqual(unknown, [], `存在目录外的权限码:\n${unknown.join('\n')}`)
})

test('未登记的后台写操作一律拒绝，读操作退化为站点级闸门', () => {
  const write = resolveAdminRouteGuard('/api/admin/some-new-domain', 'POST')
  assert.equal(write?.deny, true)
  assert.equal(write?.fallback, true)

  const read = resolveAdminRouteGuard('/api/admin/some-new-domain', 'GET')
  assert.deepEqual(read?.all, [PRIV_ADMIN_CONSOLE])
  assert.equal(allowedRoles('/api/admin/some-new-domain', 'GET').join(','), CONSOLE.join(','))
  assert.equal(resolveAdminRouteGuard('/api/songs/public', 'GET'), null)
})

test('显式拒绝优先于显式授予与角色模板', () => {
  const base = resolveEffectivePermissions({ role: 'ADMIN' }, null)
  assert.equal(hasPermission(base, 'songs:review'), true)

  const denied = resolveEffectivePermissions({ role: 'ADMIN', permissions: ['!songs:review'] }, null)
  assert.equal(hasPermission(denied, 'songs:review'), false)
  assert.equal(hasPermission(denied, 'songs:read'), true)

  const granted = resolveEffectivePermissions({ role: 'SONG_ADMIN', permissions: ['users:read'] }, null)
  assert.equal(hasPermission(granted, 'users:read'), true)
  assert.equal(hasPermission(granted, 'users:write'), false)
})

test('通配符按域生效，目录外的码在归一化时丢弃', () => {
  const songsOnly = normalizePermissionTokens(['songs:*', '!songs:delete', 'nope:read', '', 'songs:read'])
  assert.deepEqual(songsOnly, ['songs:*', '!songs:delete', 'songs:read'])
  assert.equal(hasPermission(songsOnly, 'songs:write'), true)
  assert.equal(hasPermission(songsOnly, 'songs:delete'), false)
  assert.equal(hasPermission(songsOnly, 'users:read'), false)

  const superPerms = resolveRoleTemplate('SUPER_ADMIN', null)
  assert.equal(hasPermission(superPerms, 'anything:goes') || hasPermission(superPerms, PRIV_ADMIN_CONSOLE), true)
  assert.equal(hasPermission(['*'], PRIV_ADMIN_CONSOLE), true)
})

test('角色模板被显式配置覆盖，缺失角色回落到默认模板', () => {
  const overridden = resolveRoleTemplate('SONG_ADMIN', { SONG_ADMIN: ['priv:admin-console', 'stats:read'] })
  assert.deepEqual(overridden, ['priv:admin-console', 'stats:read'])
  assert.deepEqual(resolveRoleTemplate('ADMIN', { SONG_ADMIN: [] }), [...ROLE_PERMISSION_TEMPLATES_DEFAULT.ADMIN])
  assert.deepEqual(resolveRoleTemplate('SONG_ADMIN', { SONG_ADMIN: [] }), [])
  assert.deepEqual(resolveEffectivePermissions(null, null), [])
})

test('普通用户模板不含后台闸门码，无法访问任何后台接口', () => {
  const perms = resolveEffectivePermissions({ role: 'USER' }, null)
  assert.deepEqual(perms, [])
  assert.equal(hasPermission(perms, PRIV_ADMIN_CONSOLE), false)
  assert.deepEqual(allowedRoles('/api/admin/stats', 'GET'), [...CONSOLE])
})

// 重构前 canAccessPage 硬编码的页面入口清单（侧边栏与 tab 渲染的唯一依据），页面码必须逐项还原
const UI_PAGES_BEFORE_REFACTOR: Record<string, readonly string[]> = {
  SONG_ADMIN: ['overview', 'schedule', 'print', 'songs', 'playtimes', 'request-times', 'semesters', 'data-analysis', 'card-codes'],
  ADMIN: ['overview', 'schedule', 'print', 'songs', 'users', 'grade-class', 'playtimes', 'request-times', 'semesters', 'data-analysis', 'card-codes', 'music-source'],
  SUPER_ADMIN: ADMIN_PAGE_IDS
}

test('后台页面入口与重构前一致，仅补充普通管理员与歌曲管理员的修改密码页', () => {
  for (const [role, expected] of Object.entries(UI_PAGES_BEFORE_REFACTOR)) {
    const perms = resolveEffectivePermissions({ role }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
    const actual = accessiblePages(perms).filter((page) => page !== 'password')
    const expectedPages = expected
      .filter((page) => page !== 'password')
      .sort((a, b) => ADMIN_PAGE_IDS.indexOf(a) - ADMIN_PAGE_IDS.indexOf(b))
    assert.deepEqual(actual, expectedPages, `${role} 页面入口与重构前不一致`)
  }
  for (const role of ['ADMIN', 'SONG_ADMIN']) {
    const perms = resolveEffectivePermissions({ role }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
    assert.ok(accessiblePages(perms).includes('password'), `${role} 应有修改密码入口`)
  }
  assert.deepEqual(accessiblePages(resolveEffectivePermissions({ role: 'USER' }, null)), [])
})

test('显式授予的权限码可直接越过角色模板，后台闸门只看解析后的权限', () => {
  const denied = allowedRoles('/api/admin/users', 'GET')
  assert.deepEqual(denied, [...MANAGER])

  // 普通用户被单独授予用户列表权限后应可通过；重构前端点内联名单会把它拒成 500
  const granted = resolveEffectivePermissions(
    { role: 'USER', permissions: ['users:read', PRIV_ADMIN_CONSOLE] },
    ROLE_PERMISSION_TEMPLATES_DEFAULT
  )
  const guard = resolveAdminRouteGuard('/api/admin/users', 'GET')
  assert.ok(guard && !guard.deny)
  assert.ok(hasAllPermissions(granted, guard!.all) && hasAnyPermission(granted, guard!.any))

  // 只给业务码、不给后台闸门码仍应拒绝
  const noConsole = resolveEffectivePermissions({ role: 'USER', permissions: ['users:read'] }, null)
  assert.equal(hasAllPermissions(noConsole, guard!.all), false)
})

// 端点闸门已全部收归守卫表，以下是仅存的数据级角色判定（保护超管实体、配置字段分区、按角色脱敏）
const DATA_LEVEL_ROLE_CHECKS: Record<string, number> = {
  'backup/restore-chunk.post.ts': 1,
  'backup/restore.post.ts': 1,
  'schedule/song-pool.get.ts': 1,
  'system-settings/index.post.ts': 1,
  'system-settings/index.ts': 1,
  'users/[id]/reset-password.post.ts': 1,
  'users/[id].delete.ts': 1,
  'users/[id].put.ts': 3,
  'users/batch-grade-update.post.ts': 1,
  'users/batch-status.put.ts': 2,
  'users/batch-update.post.ts': 1,
  'users/batch.post.ts': 1,
  'users/index.post.ts': 2
}

test('后台端点不再自行判定访问者角色，新增内联闸门会被此条拦下', () => {
  const ROLE_READ = /(user|currentUser|operator|actor|adminUser)\??\.\s*role\b/
  const actual: Record<string, number> = {}
  for (const rel of endpointFiles(ADMIN_API_DIR)) {
    const count = readFileSync(new URL(`../../server/api/admin/${rel}`, import.meta.url), 'utf8')
      .split('\n')
      .filter((line) => ROLE_READ.test(line)).length
    if (count) actual[rel] = count
  }
  assert.deepEqual(actual, DATA_LEVEL_ROLE_CHECKS, '后台端点出现新的访问者角色判定，应改为守卫表登记')
})
