/**
 * S3-B1 单测：routePermissionMap（判定词汇 / 第一条命中胜出 / 精确与兜底边界）。
 *
 * 与 `scripts/contract-checks/route-coverage.mjs` 的分工：
 *   - 契约检查：遍历 `server/api/**` 全量路由，断言**没有未分类**（CI 门禁，慢但全覆盖）；
 *   - 本用例：把判定语义钉死（方法敏感、顺序敏感、admin/open 无登录兜底、路径规范化）。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OPEN_ROUTE_RULES,
  ROUTE_RULES,
  classifyApiRoute,
  normalizeRoutePath,
  resolveRoutePermission,
  validateRouteRules
} from '../../../../server/utils/rbac/routePermissionMap.ts'
import { API_PERMISSION_KEYS } from '../../../../server/utils/rbac/constants.ts'

test('S3-B1 规则表自检：全部 key 都在 catalog 内，且 open 规则只用 API 权限', () => {
  assert.deepEqual(validateRouteRules(), [])
  assert.ok(ROUTE_RULES.length > 0 && OPEN_ROUTE_RULES.length > 0)
  for (const rule of OPEN_ROUTE_RULES) {
    assert.equal(API_PERMISSION_KEYS.includes(rule.key), true, `open 规则必须是 API 权限：${rule.key}`)
  }
})

test('S3-B1 判定词汇：permission / login / public / unmapped', () => {
  assert.deepEqual(classifyApiRoute('GET', '/api/admin/users'), {
    decision: 'permission',
    permission: 'user.read',
    matched: 'admin:user.read'
  })
  assert.equal(classifyApiRoute('GET', '/api/user/sessions').decision, 'login')
  assert.equal(classifyApiRoute('POST', '/api/auth/login').decision, 'public')
  assert.equal(classifyApiRoute('GET', '/api/sys/time').decision, 'public')
  // 非 API 路径（页面/静态资源）不属于本表管辖范围 ⇒ unmapped
  assert.equal(classifyApiRoute('GET', '/pages/index').decision, 'unmapped')
  // /api/** 中的普通用户路由仍是「仅需登录」，不是 unmapped
  assert.equal(classifyApiRoute('GET', '/api/not-an-api-route').decision, 'login')
})

test('S3-B1 无登录兜底：未注册的 admin / open 路由一律 unmapped（= 拒绝）', () => {
  assert.deepEqual(classifyApiRoute('GET', '/api/admin/not-registered-yet'), {
    decision: 'unmapped',
    permission: null,
    matched: null
  })
  assert.equal(classifyApiRoute('POST', '/api/open/not-registered-yet').decision, 'unmapped')
  // 普通用户域仍是「仅需登录」（不是拒绝）
  assert.equal(classifyApiRoute('GET', '/api/songs').decision, 'login')
})

test('S3-B1 方法敏感：同一路径不同方法的权限不同', () => {
  assert.equal(resolveRoutePermission('GET', '/api/admin/users/7'), 'user.read')
  assert.equal(resolveRoutePermission('PUT', '/api/admin/users/7'), 'user.manage')
  assert.equal(resolveRoutePermission('PUT', '/api/admin/users/7/status'), 'user.status')
  assert.equal(resolveRoutePermission('POST', '/api/admin/users/7/status'), 'user.manage', 'POST 只命中宽规则')
  assert.equal(resolveRoutePermission('DELETE', '/api/admin/users/7'), 'user.manage')
  assert.equal(resolveRoutePermission('PATCH', '/api/admin/blacklist/3'), 'blacklist.manage')
})

test('S3-B1 顺序敏感：精确规则先于宽前缀命中（34 条抽查）', () => {
  const samples = [
    ['POST', '/api/admin/card-codes/delete', 'card_codes.delete'],
    ['POST', '/api/admin/card-codes/create', 'card_codes.write'],
    ['GET', '/api/admin/card-codes/redeem-logs', 'card_codes.read'],
    ['POST', '/api/admin/backup/restore', 'backup.restore'],
    ['POST', '/api/admin/backup/restore-chunk', 'backup.restore'],
    ['POST', '/api/admin/backup/export', 'backup.export'],
    ['GET', '/api/admin/backup/download/2026.sql', 'backup.export'],
    ['POST', '/api/admin/backup/test-s3', 'backup.execute'],
    ['GET', '/api/admin/backup/list', 'backup.execute'],
    ['POST', '/api/admin/schedule/publish', 'schedule.publish'],
    ['POST', '/api/admin/schedule/draft', 'schedule.write'],
    ['GET', '/api/admin/schedule/full', 'schedule.read'],
    ['POST', '/api/admin/songs/reject', 'song.reject'],
    ['POST', '/api/admin/songs/mark-played', 'song.write'],
    ['GET', '/api/admin/stats/trends', 'stats.read'],
    ['GET', '/api/admin/activities', 'stats.read'],
    ['GET', '/api/admin/db-status', 'system_settings.read'],
    ['GET', '/api/admin/system-settings/env-oauth', 'system_settings.read'],
    ['POST', '/api/admin/system-settings/clear-aggregate-bindings', 'system_settings.write'],
    ['DELETE', '/api/admin/api-keys/abc', 'api_keys.delete'],
    ['GET', '/api/admin/api-keys/logs', 'api_keys.read'],
    ['POST', '/api/admin/fix-sequence', 'database.reset'],
    ['POST', '/api/admin/database/cleanup', 'database.reset'],
    ['GET', '/api/admin/database/status', 'database.reset'],
    ['GET', '/api/admin/music-source-plugins', 'system_settings.read'],
    ['PUT', '/api/admin/music-source-plugins/order', 'system_settings.write'],
    ['GET', '/api/admin/notifications/history', 'notification.send'],
    ['DELETE', '/api/admin/notifications/history/batch-1', 'notification.send'],
    ['GET', '/api/admin/semesters', 'semester.manage'],
    ['GET', '/api/admin/grade-class', 'grade_class.manage'],
    ['GET', '/api/admin/blacklist', 'blacklist.manage'],
    ['GET', '/api/admin/users/export', 'user.read'],
    ['GET', '/api/admin/replay-requests', 'song.read'],
    ['POST', '/api/admin/replay-requests/reject', 'song.reject']
  ]

  for (const [method, pathname, expected] of samples) {
    assert.equal(resolveRoutePermission(method, pathname), expected, `${method} ${pathname}`)
  }
})

test('S3-B1 open 域：按 API Key 权限判定（含历史语义合并）', () => {
  assert.equal(resolveRoutePermission('GET', '/api/open/songs'), 'song.read')
  assert.equal(resolveRoutePermission('POST', '/api/open/songs/request'), 'song.read', 'songs:request 已并入 song.read')
  assert.equal(resolveRoutePermission('POST', '/api/open/songs/mark-played'), 'song.write')
  assert.equal(resolveRoutePermission('GET', '/api/open/schedules'), 'schedule.read')
  assert.equal(resolveRoutePermission('POST', '/api/open/card-codes/delete'), 'card_codes.delete')
  assert.equal(resolveRoutePermission('DELETE', '/api/open/card-codes/abc'), 'card_codes.delete')
  assert.equal(resolveRoutePermission('PATCH', '/api/open/card-codes/abc'), 'card_codes.write')
  assert.equal(resolveRoutePermission('GET', '/api/open/card-codes'), 'card_codes.read')
  assert.equal(resolveRoutePermission('POST', '/api/open/backup/auto'), 'backup.execute')
})

test('S3-B1 路径规范化：查询串与尾部斜杠不影响判定', () => {
  assert.equal(normalizeRoutePath('/api/admin/users/?page=2'), '/api/admin/users')
  assert.equal(normalizeRoutePath('/api/admin/users///'), '/api/admin/users')
  assert.equal(normalizeRoutePath(''), '/')
  assert.equal(
    JSON.stringify(classifyApiRoute('GET', '/api/admin/users?page=2')),
    JSON.stringify(classifyApiRoute('GET', '/api/admin/users'))
  )
})

test('S3-B1 rbac 域的 7 个端点已被注册（S3-B5 / S4 依赖）', () => {
  assert.equal(resolveRoutePermission('GET', '/api/admin/rbac/my-permissions'), 'permissions.read')
  assert.equal(resolveRoutePermission('GET', '/api/admin/rbac/permissions'), 'permissions.read')
  assert.equal(resolveRoutePermission('GET', '/api/admin/rbac/roles'), 'permissions.read')
  assert.equal(resolveRoutePermission('PUT', '/api/admin/rbac/roles/ADMIN'), 'role.manage')
  assert.equal(resolveRoutePermission('GET', '/api/admin/rbac/user-permissions'), 'permissions.read')
  assert.equal(resolveRoutePermission('POST', '/api/admin/rbac/user-permissions'), 'user_permissions.manage')
  assert.equal(resolveRoutePermission('DELETE', '/api/admin/rbac/user-permissions/3'), 'user_permissions.manage')
})
