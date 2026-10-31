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

// 源码里出现的角色名单（含校验用全角色名单），按集合解析避免误判白名单顺序
function roleSetsIn(source: string): string[][] {
  return [...source.matchAll(/\[[^\[\]]*\]/g)]
    .map((match) => [...match[0].matchAll(/['"](USER|SONG_ADMIN|ADMIN|SUPER_ADMIN)['"]/g)].map((role) => role[1]))
    .filter((roles) => roles.length)
}

function sameSet(a: string[], b: readonly string[]): boolean {
  return a.length === b.length && b.every((role) => a.includes(role))
}

// 重构前每个端点的实际放行角色：接口内判定优先，无判定时由 /api/admin 中间件兜底
function expectedRoles(source: string): readonly string[] {
  if (/pluginAccess\(event,\s*true/.test(source)) return SUPER
  if (/verifySuperAdminAuth/.test(source)) return SUPER
  if (/requireSongAdmin\(/.test(source)) return CONSOLE
  if (/canSendSystemNotification/.test(source)) return MANAGER

  const sets = roleSetsIn(source)
  if (sets.some((roles) => sameSet(roles, CONSOLE))) return CONSOLE
  if (sets.some((roles) => sameSet(roles, MANAGER))) return MANAGER

  if (/\.role\s*!==\s*['"]SUPER_ADMIN['"]/.test(source)) return SUPER
  if (/verifyAdminAuth/.test(source)) return MANAGER
  return CONSOLE
}

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

test('守卫表覆盖全部后台端点与角色结论，与重构前逐项一致', () => {
  const files = endpointFiles(ADMIN_API_DIR)
  // 端点扫描失效时禁止空跑通过
  assert.ok(files.length > 100, `后台端点扫描异常: ${files.length}`)

  const mismatches: string[] = []
  for (const rel of files) {
    const source = readFileSync(new URL(`file://${decodeURIComponent(ADMIN_API_DIR.pathname)}/${rel}`), 'utf8')
    const expected = expectedRoles(source)
    const { pathname, methods } = toPathname(rel)
    for (const method of methods) {
      const actual = allowedRoles(pathname, method)
      if (actual.join(',') !== expected.join(',')) {
        mismatches.push(`${method} ${pathname} (${rel}) 期望 ${expected.join('|')} 实际 ${actual.join('|') || '无'}`)
      }
    }
  }
  assert.deepEqual(mismatches, [], `后台守卫表与重构前不一致:\n${mismatches.join('\n')}`)
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
