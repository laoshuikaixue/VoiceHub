import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_PERMISSION_CODES,
  PRIV_ADMIN_CONSOLE,
  PRIV_GRANT,
  PRIV_ROLE_TEMPLATE,
  PROTECTED_PRIV_CODES,
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  ROLE_TEMPLATE_KEYS,
  groupPermissionCodes,
  hasPermission,
  isValidPermissionToken,
  splitGrantTokens
} from '../../app/utils/admin-permissions.ts'
import {
  collectCodeHolders,
  findGrantsBeyondOperator,
  findProtectedCodeLoss,
  findProtectedLossAfterReplacement,
  findProtectedLossAfterReplacements,
  validateExplicitGrants,
  validateRoleTemplates,
  type PolicyResult
} from '../../server/utils/permission-policy.ts'
import { resolveAdminRouteGuard } from '../../server/utils/admin-permission-routes.ts'
import { SERVER_ERROR_CODES } from '../../server/config/constants.ts'
import { admin as zhAdmin, serverErrors as zhServerErrors } from '../../app/utils/locale/zh-CN.ts'
import { admin as enAdmin, serverErrors as enServerErrors } from '../../app/utils/locale/en-US.ts'

const SUPER = { id: 1, role: 'SUPER_ADMIN', permissions: null }
const ADMIN = { id: 2, role: 'ADMIN', permissions: null }
const SONG_ADMIN = { id: 3, role: 'SONG_ADMIN', permissions: null }

function unwrap<T>(result: PolicyResult<T>): T {
  assert.equal(result.ok, true, JSON.stringify((result as any).violation))
  return (result as { ok: true; value: T }).value
}

function expectViolation(result: PolicyResult<unknown>, code: string): string[] | undefined {
  assert.equal(result.ok, false, `非法输入被接受：${code}`)
  const violation = (result as { ok: false; violation: { code: string; status: number; params?: string[] } })
    .violation
  assert.equal(violation.code, code)
  return violation.params
}

test('站点级能力码已进目录且受安全阀保护', () => {
  for (const code of [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE, PRIV_GRANT]) {
    assert.ok(ADMIN_PERMISSION_CODES.includes(code), `目录缺站点级码：${code}`)
    assert.ok(PROTECTED_PRIV_CODES.includes(code), `安全阀未保护站点级码：${code}`)
  }
  assert.equal(
    PROTECTED_PRIV_CODES.every((code) => code.startsWith('priv:')),
    true,
    '安全阀只应保护站点级能力'
  )
})

test('新增错误码在常量与中英词典三处同步', () => {
  const keys = [
    'PERMISSION_TEMPLATE_INVALID',
    'PERMISSION_GRANT_INVALID',
    'PERMISSION_GRANT_EXCEEDS_SELF',
    'PERMISSION_GRANT_TARGET_FORBIDDEN',
    'PERMISSION_LAST_HOLDER_PROTECTED',
    'PERMISSION_SELF_LOCKOUT',
    'PERMISSION_SELF_EDIT_FORBIDDEN'
  ]
  for (const key of keys) {
    assert.ok((SERVER_ERROR_CODES as Record<string, string>)[key], `SERVER_ERROR_CODES 缺 ${key}`)
    assert.ok(key in zhServerErrors, `zh serverErrors 缺 ${key}`)
    assert.ok(key in enServerErrors, `en serverErrors 缺 ${key}`)
  }
})

test('权限矩阵与按用户授权接口的守卫已登记且不兜底', () => {
  const cases = [
    ['/api/admin/permissions/matrix', 'GET', PRIV_ROLE_TEMPLATE],
    ['/api/admin/permissions/matrix', 'PUT', PRIV_ROLE_TEMPLATE],
    ['/api/admin/users/7/permissions', 'GET', PRIV_GRANT],
    ['/api/admin/users/7/permissions', 'PUT', PRIV_GRANT]
  ] as const
  for (const [path, method, code] of cases) {
    const guard = resolveAdminRouteGuard(path, method)
    assert.ok(guard, `${method} ${path} 未登记守卫`)
    assert.equal(guard!.fallback, false, `${method} ${path} 落在兜底策略`)
    assert.equal(guard!.deny, false)
    assert.deepEqual(guard!.any, [code], `${method} ${path} 所需权限码不符`)
    assert.deepEqual(guard!.all, [PRIV_ADMIN_CONSOLE])
  }
})

test('未登记的写操作默认拒绝', () => {
  const guard = resolveAdminRouteGuard('/api/admin/permissions/matrix/extra', 'POST')
  assert.equal(guard!.fallback, true)
  assert.equal(guard!.deny, true)
})

test('角色模板校验：缺省角色回落内置模板，输出覆盖全部可配置角色', () => {
  const value = unwrap(validateRoleTemplates({ ADMIN: ['songs:write'] })) as Record<string, string[]>
  assert.deepEqual(Object.keys(value).sort(), [...ROLE_TEMPLATE_KEYS].sort())
  assert.deepEqual(value.ADMIN, ['songs:write'])
  assert.deepEqual(value.SUPER_ADMIN, [...(ROLE_PERMISSION_TEMPLATES_DEFAULT.SUPER_ADMIN ?? [])])
})

test('角色模板校验：结构非法、未知角色与目录外码一律 400', () => {
  for (const input of [null, undefined, [], 'ADMIN', 42]) {
    expectViolation(validateRoleTemplates(input), SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID)
  }
  assert.deepEqual(
    expectViolation(validateRoleTemplates({ OPERATOR: ['songs:write'] }), SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID),
    ['OPERATOR']
  )
  expectViolation(validateRoleTemplates({ ADMIN: 'songs:write' }), SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID)
  assert.deepEqual(
    expectViolation(
      validateRoleTemplates({ ADMIN: ['songs:write', 'songs:nope'] }),
      SERVER_ERROR_CODES.PERMISSION_TEMPLATE_INVALID
    ),
    ['songs:nope']
  )
})

test('显式授权校验：null 回到跟随模板，数组归一化并保持顺序', () => {
  assert.deepEqual(validateExplicitGrants(null), { ok: true, value: null })
  assert.deepEqual(
    unwrap(validateExplicitGrants(['songs:write', ' !songs:delete ', 'songs:write'])),
    ['songs:write', '!songs:delete']
  )
  for (const input of ['songs:write', { songs: ['create'] }, [123], ['songs:nope']]) {
    expectViolation(validateExplicitGrants(input), SERVER_ERROR_CODES.PERMISSION_GRANT_INVALID)
  }
})

test('越权授权识别：只能授出自己持有的码，通配按持有口径放行', () => {
  assert.deepEqual(findGrantsBeyondOperator(['songs:write'], ['*']), [])
  assert.deepEqual(findGrantsBeyondOperator(['songs:write', '!users:read'], ['songs:*', 'users:read']), [])
  assert.deepEqual(findGrantsBeyondOperator(['users:read'], ['songs:*']), ['users:read'])
  // 拒绝码同样只能拒掉自己持有的权限
  assert.deepEqual(findGrantsBeyondOperator(['!users:read'], ['songs:write']), ['!users:read'])
})

test('安全阀：操作者撤销自己的后台入口被拒（自锁保护）', () => {
  const beforeTemplates = {
    SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE],
    ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE]
  }
  const afterTemplates = { SUPER_ADMIN: [PRIV_ROLE_TEMPLATE], ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE] }
  const rows = [SUPER, ADMIN]
  const loss = findProtectedCodeLoss(
    collectCodeHolders(rows, beforeTemplates, PROTECTED_PRIV_CODES),
    collectCodeHolders(rows, afterTemplates, PROTECTED_PRIV_CODES),
    SUPER.id
  )
  assert.equal(loss?.code, SERVER_ERROR_CODES.PERMISSION_SELF_LOCKOUT)
  assert.equal(loss?.status, 403)
  // 交出 priv:role-template 有人接手不算违规，但丢掉后台入口一律拦住
  assert.deepEqual(loss?.params, [PRIV_ADMIN_CONSOLE])
})

test('安全阀：交出站点级能力后仍有人持有则放行，无人接手才算最后一个持有者', () => {
  const rows = [SUPER, ADMIN]
  const before = collectCodeHolders(
    rows,
    { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE], ADMIN: [PRIV_ADMIN_CONSOLE] },
    PROTECTED_PRIV_CODES
  )
  // 超管把模板编辑能力交给普通管理员，自己的后台入口不变
  const handedOver = collectCodeHolders(
    rows,
    { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE], ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE] },
    PROTECTED_PRIV_CODES
  )
  assert.equal(findProtectedCodeLoss(before, handedOver, SUPER.id), null)

  // 同一能力没有任何账号接手 → 全站失去该能力
  const orphaned = collectCodeHolders(
    rows,
    { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE], ADMIN: [PRIV_ADMIN_CONSOLE] },
    PROTECTED_PRIV_CODES
  )
  const loss = findProtectedCodeLoss(before, orphaned, SUPER.id)
  assert.equal(loss?.code, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED)
  assert.deepEqual(loss?.params, [PRIV_ROLE_TEMPLATE])
})

test('安全阀：站点级能力失去最后一个持有者被拒，即便操作者并不持有', () => {
  const beforeTemplates = {
    SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE],
    ADMIN: [PRIV_ADMIN_CONSOLE]
  }
  const afterTemplates = { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE], ADMIN: [PRIV_ADMIN_CONSOLE] }
  const rows = [SUPER, ADMIN]
  const loss = findProtectedCodeLoss(
    collectCodeHolders(rows, beforeTemplates, PROTECTED_PRIV_CODES),
    collectCodeHolders(rows, afterTemplates, PROTECTED_PRIV_CODES),
    ADMIN.id
  )
  assert.equal(loss?.code, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED)
  assert.deepEqual(loss?.params, [PRIV_ROLE_TEMPLATE])
})

test('安全阀：能力转移或扩散给他人时放行，从未有人持有也不拦', () => {
  const rows = [SUPER, ADMIN]
  const beforeTemplates = { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE], ADMIN: [PRIV_ADMIN_CONSOLE] }
  const before = collectCodeHolders(rows, beforeTemplates, PROTECTED_PRIV_CODES)
  const after = collectCodeHolders(
    rows,
    { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE], ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE] },
    PROTECTED_PRIV_CODES
  )
  assert.equal(findProtectedCodeLoss(before, after, SUPER.id), null)

  // 从未有人持有的站点级能力（内置默认模板下普通管理员无 priv:grant）不触发最后一个持有者
  const emptyTemplates = { SUPER_ADMIN: [PRIV_ADMIN_CONSOLE], ADMIN: [PRIV_ADMIN_CONSOLE] }
  const empty = collectCodeHolders(rows, emptyTemplates, PROTECTED_PRIV_CODES)
  assert.deepEqual(empty[PRIV_GRANT], [])
  assert.equal(findProtectedCodeLoss(empty, empty, SUPER.id), null)

  // 停用账号不计入持有者：调用方只传活跃行，此处校验空表不产生违规
  assert.equal(findProtectedCodeLoss(collectCodeHolders([], null, PROTECTED_PRIV_CODES), empty, SUPER.id), null)
})

test('账号变更安全阀：删除或降级导致最后一个持有者消失被拒', () => {
  const rows = [SUPER, ADMIN, SONG_ADMIN]
  // 站点级能力分布：priv:role-template 只剩歌曲管理员一人持有
  const matrixTemplates = {
    SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_GRANT],
    ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_GRANT],
    SONG_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE],
    USER: []
  }

  // 唯一持有 priv:role-template 的歌曲管理员被降级为 USER，且操作者本人不持有该码
  const demote = findProtectedLossAfterReplacement(
    rows,
    matrixTemplates,
    SONG_ADMIN.id,
    { id: SONG_ADMIN.id, role: 'USER', permissions: null },
    ADMIN.id
  )
  assert.equal(demote?.code, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED)
  assert.equal(demote?.status, 403)
  assert.deepEqual(demote?.params, [PRIV_ROLE_TEMPLATE])

  // 同一账号被删除（退出持有者集合）同样被拒
  const removed = findProtectedLossAfterReplacement(rows, matrixTemplates, SONG_ADMIN.id, null, ADMIN.id)
  assert.equal(removed?.code, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED)

  // 降级后仍以显式授权保留该能力，并且仍进得了后台：放行
  const kept = findProtectedLossAfterReplacement(
    rows,
    matrixTemplates,
    SONG_ADMIN.id,
    { id: SONG_ADMIN.id, role: 'USER', permissions: [PRIV_ADMIN_CONSOLE, PRIV_ROLE_TEMPLATE] },
    ADMIN.id
  )
  assert.equal(kept, null)

  // 降级后只剩 priv:role-template：进不了后台的账号用不上站点级能力，视为失去
  const demoteWithoutConsole = findProtectedLossAfterReplacement(
    rows,
    matrixTemplates,
    SONG_ADMIN.id,
    { id: SONG_ADMIN.id, role: 'USER', permissions: [PRIV_ROLE_TEMPLATE] },
    ADMIN.id
  )
  assert.equal(demoteWithoutConsole?.code, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED)
  assert.deepEqual(demoteWithoutConsole?.params, [PRIV_ROLE_TEMPLATE])

  // 变更的是操作者自己：按自锁拒绝
  const self = findProtectedLossAfterReplacement(rows, matrixTemplates, ADMIN.id, null, ADMIN.id)
  assert.equal(self?.code, SERVER_ERROR_CODES.PERMISSION_SELF_LOCKOUT)
  assert.deepEqual(self?.params, [PRIV_ADMIN_CONSOLE])
})

test('批量账号变更按整批结果判定：逐个放行但一起清空仍被拒', () => {
  const templates = {
    SUPER_ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_GRANT],
    ADMIN: [PRIV_ADMIN_CONSOLE, PRIV_GRANT],
    SONG_ADMIN: [PRIV_ADMIN_CONSOLE],
    USER: []
  }
  const rows = [SUPER, ADMIN, SONG_ADMIN]
  const changes = [
    { targetId: SUPER.id, nextRow: null },
    { targetId: ADMIN.id, nextRow: null }
  ]
  // 单独停用一个，priv:grant 仍有他人持有
  assert.equal(findProtectedLossAfterReplacements(rows, templates, [changes[0]!], SONG_ADMIN.id), null)
  assert.equal(findProtectedLossAfterReplacements(rows, templates, [changes[1]!], SONG_ADMIN.id), null)

  // 一次批量停用把两个持有者一起移出
  const loss = findProtectedLossAfterReplacements(rows, templates, changes, SONG_ADMIN.id)
  assert.equal(loss?.code, SERVER_ERROR_CODES.PERMISSION_LAST_HOLDER_PROTECTED)
  assert.deepEqual(loss?.params, [PRIV_GRANT])
})

test('持有者统计按有效权限计算：显式授予与显式拒绝都生效', () => {
  const templates = {
    ADMIN: [PRIV_ADMIN_CONSOLE, 'songs:write'],
    SONG_ADMIN: [PRIV_ADMIN_CONSOLE, 'songs:write']
  }
  const rows = [{ ...ADMIN, permissions: ['users:read'] }, { ...SONG_ADMIN, permissions: ['!songs:write'] }]
  const holders = collectCodeHolders(rows, templates, ['songs:write', 'users:read'])
  assert.deepEqual(holders['songs:write'], [ADMIN.id], '显式拒绝应移除持有')
  assert.deepEqual(holders['users:read'], [ADMIN.id], '显式授予应新增持有')
  assert.deepEqual(collectCodeHolders([ADMIN], templates, ['songs:write'])['songs:write'], [ADMIN.id])
})

test('持有者统计只算进得了后台的账号', () => {
  const templates = { SONG_ADMIN: [PRIV_ROLE_TEMPLATE] }
  const row = { ...SONG_ADMIN, permissions: null }
  assert.deepEqual(collectCodeHolders([row], templates, [PRIV_ROLE_TEMPLATE])[PRIV_ROLE_TEMPLATE], [])
  // 补上后台入口后同一账号就是该能力的持有者
  const reachable = { ...SONG_ADMIN, permissions: [PRIV_ADMIN_CONSOLE] }
  assert.deepEqual(
    collectCodeHolders([reachable], templates, [PRIV_ROLE_TEMPLATE])[PRIV_ROLE_TEMPLATE],
    [SONG_ADMIN.id]
  )
})

test('权限码分组：站点级能力在最前，其余按目录顺序且不重不漏', () => {
  const groups = groupPermissionCodes()
  assert.equal(groups[0]!.domain, 'priv')
  assert.ok(groups[0]!.codes.includes(PRIV_ROLE_TEMPLATE))
  const domains = groups.map((group) => group.domain)
  assert.equal(new Set(domains).size, domains.length, '分组出现重复域')
  for (const group of groups) assert.ok(group.codes.every((code) => code.startsWith(`${group.domain}:`)))
  assert.equal(
    groups.reduce((total, group) => total + group.codes.length, 0),
    ADMIN_PERMISSION_CODES.length
  )
})

test('显式授权拆分与权限码校验口径', () => {
  assert.deepEqual(splitGrantTokens(['songs:write', '!users:read', 'songs:nope']), {
    grants: ['songs:write'],
    denies: ['users:read']
  })
  assert.deepEqual(splitGrantTokens(null), { grants: [], denies: [] })
  for (const token of ['*', 'songs:*', '!songs:*', 'page:permissions', PRIV_GRANT]) {
    assert.equal(isValidPermissionToken(token), true, `${token} 应合法`)
  }
  for (const token of ['', '  ', 'songs:nope', undefined, 42]) {
    assert.equal(isValidPermissionToken(token), false, `${JSON.stringify(token)} 应非法`)
  }
})

test('通配判定：全量通配通过，显式拒绝优先于授予', () => {
  assert.equal(hasPermission(['*'], PRIV_GRANT), true)
  assert.equal(hasPermission(['priv:*'], PRIV_GRANT), true)
  assert.equal(hasPermission(['priv:grant'], PRIV_GRANT), true)
  assert.equal(hasPermission(['songs:*'], PRIV_GRANT), false)
  assert.equal(hasPermission(['priv:grant', '!priv:grant'], PRIV_GRANT), false)
})

test('中英词典：权限矩阵与按用户授权分区键完全对齐', () => {
  const flatten = (value: unknown, prefix = ''): string[] => {
    if (!value || typeof value !== 'object') return [prefix]
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key)
    )
  }
  for (const partition of ['permissionMatrix', 'userPermissions']) {
    const zh = flatten((zhAdmin as any)[partition]).sort()
    const en = flatten((enAdmin as any)[partition]).sort()
    assert.ok(zh.length > 1, `${partition} 分区为空`)
    assert.deepEqual(zh, en, `${partition} 中英键不一致`)
  }
  assert.deepEqual(Object.keys(zhServerErrors).sort(), Object.keys(enServerErrors).sort())
})
