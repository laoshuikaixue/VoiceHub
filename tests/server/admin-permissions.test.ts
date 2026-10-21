import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PERMISSION_CODES,
  ROLE_PERMISSION_CODES,
  SONG_ADMIN_GRANTABLE_PERMISSION_CODES,
  SYSTEM_ADMIN_PERMISSION_CODES,
  normalizePermissionCodes,
  resolveEffectivePermissions
} from '../../app/utils/adminPermissions.ts'

const REPO_ROOT = join(fileURLToPath(new URL(import.meta.url)), '../../..')

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

test('权限守卫不得写在会把错误压成 5xx 的 try 内', () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.ts')) files.push(p)
    }
  }
  walk(join(REPO_ROOT, 'server/api'))
  assert.ok(files.length > 50, `接口文件扫描异常，仅找到 ${files.length} 个文件`)

  const GUARD = /^\s*require(AdminPermission|AdminAccess|SystemAdmin|SuperAdmin)\(/
  const CATCH = /^\s*\}\s*catch\b|^\s*catch\b/
  // 就近 catch 里透传已有状态码的写法可安全承载守卫
  const PRESERVES_STATUS = /if\s*\(\s*error\??\.statusCode|statusCode:\s*error\??\.statusCode/

  const catchPreservesStatus = (lines: string[], from: number): boolean => {
    for (let k = from + 1; k < lines.length; k++) {
      if (!CATCH.test(lines[k])) continue
      return PRESERVES_STATUS.test(lines.slice(k, k + 20).join('\n'))
    }
    return false
  }

  const offenders: string[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!GUARD.test(lines[i])) continue
      let inTry = false
      for (let j = i - 1; j >= 0; j--) {
        if (/^\s*try\s*\{\s*$/.test(lines[j])) {
          inTry = true
          break
        }
        if (/defineEventHandler\(/.test(lines[j])) break
      }
      if (inTry && !catchPreservesStatus(lines, i)) {
        offenders.push(`${file.slice(REPO_ROOT.length + 1)}:${i + 1}`)
      }
    }
  }
  assert.deepEqual(offenders, [], '守卫应写在 try 之外，否则 401/403 会被 catch 改写为 500 并泄漏内部错误文本')
})

test('排期表写入端点要求 schedule:write，备选池保持 songs:pool', () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.ts')) files.push(p)
    }
  }
  walk(join(REPO_ROOT, 'server/api/admin'))

  const domain = files.filter(
    (p) => /\/admin\/schedule\.post\.ts$/.test(p) || /\/admin\/schedule\//.test(p)
  )
  assert.ok(domain.length >= 13, `排期域扫描异常，仅找到 ${domain.length} 个文件`)

  const guardCodes = (src: string): string[] =>
    [...src.matchAll(/requireAdminPermission\(event,\s*'([a-z:-]+)'\)/g)].map((m) => m[1])
  const writer = (table: string) =>
    new RegExp(`\\b(?:insert|update|delete)\\((?:tx\\.)?${table}\\)`)

  const scheduleOffenders: string[] = []
  const poolOffenders: string[] = []
  for (const p of domain) {
    const src = readFileSync(p, 'utf8')
    const rel = p.slice(REPO_ROOT.length + 1)
    if (writer('schedules').test(src) && !guardCodes(src).includes('schedule:write'))
      scheduleOffenders.push(rel)
    if (writer('scheduleSongPool').test(src) && !guardCodes(src).includes('songs:pool'))
      poolOffenders.push(rel)
  }
  assert.deepEqual(
    scheduleOffenders,
    [],
    '写入 schedules 表的端点必须要求 schedule:write，否则未获授权的歌曲管理员可改写整日排期'
  )
  assert.deepEqual(poolOffenders, [], '备选池写入属歌曲管理员本职，不应升级为 schedule:write')
})

test('可授予档位在 zh/en 词典都有标签', () => {
  for (const lang of ['zh-CN', 'en-US']) {
    const src = readFileSync(join(REPO_ROOT, 'app/utils/locale', `${lang}.ts`), 'utf8')
    for (const code of SONG_ADMIN_GRANTABLE_PERMISSION_CODES) {
      assert.ok(src.includes(`'${code}':`), `${lang} 缺少 ${code} 的 permissionLabels 标签`)
    }
  }
})
