/**
 * 契约检查 · 路由覆盖（S3-B1 · R-41）。
 *
 * A. **每条路由都必须被显式分类**：`server/api/**` 下按 Nuxt 约定推导出的每个 (method, path)
 *    都必须命中 `permission` / `login` / `public`；命中不到即为 `unmapped` —— 运行时它是
 *    「默认拒绝」，会把新路由静默变成 403，所以在这里提前拦下。
 *    无方法后缀的文件（`[id].ts` / `index.ts`）按 ANY 处理：GET/POST/PUT/PATCH/DELETE 都必须被分类。
 * B. 规则表的 key 必须是 catalog 内合法权限；`/api/open/**` 的 key 还必须是 API 权限。
 * C. TASKS.md S3-B1 明示的两条精确路径必须覆盖：`/api/open/songs`、`/api/open/schedules`。
 * D. **顺序敏感**抽查：更具体的规则必须先于更宽的前缀命中（第一条命中胜出）。
 *
 * 跑器：`node scripts/check-permission-contract.mjs`。
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { API_PERMISSION_KEYS, isPermissionKey } from '../../shared/rbac/permission-catalog.js'
import {
  OPEN_ROUTE_RULES,
  classifyApiRoute,
  validateRouteRules
} from '../../server/utils/rbac/routePermissionMap.ts'

const ROOT = process.cwd()
const API_DIR = path.join(ROOT, 'server', 'api')
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist'])
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/**
 * `server/api/**` 下的**非路由模块**（无 `defineEventHandler` / 无 default export）。
 * Nitro 会把 api 目录下每个 .ts 当路由处理，这类文件属于**放错位置**的辅助模块：
 * 这里显式登记以便契约通过，同时登记「谁负责迁出」；新增未登记的非路由模块会被 A 检查拦下。
 */
const NON_ROUTE_MODULES = new Map([
  [
    'server/api/admin/api-keys/permissions.ts',
    'API Key 权限 zod 枚举（写入侧冒号词表）；S5-5 负责改为从 catalog 取值并迁出 api 目录'
  ],
  [
    'server/api/admin/system-settings/secretMask.ts',
    '系统设置密钥打码工具（非路由）；S3-B4-1 负责把它迁到 server/utils/ 并同步调用方 import'
  ]
])

function isRouteModule(file) {
  const text = fs.readFileSync(file, 'utf8')
  return /defineEventHandler\s*\(/.test(text) || /export\s+default\s+/.test(text)
}

const relative = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/')

function walk(dir, collected = []) {
  if (!fs.existsSync(dir)) return collected
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), collected)
    } else if (entry.name.endsWith('.ts')) {
      collected.push(path.join(dir, entry.name))
    }
  }
  return collected
}

/** Nuxt 文件名 → (methods, route)。无方法后缀 ⇒ ANY（所有方法都要被分类） */
function describeRouteFile(file) {
  const basename = path.basename(file)
  const match = basename.match(/\.(get|post|put|patch|delete|head|options)\.ts$/)
  const methods = match ? [match[1].toUpperCase()] : METHODS

  const rel = path.relative(API_DIR, file).split(path.sep).join('/')
  const withoutExt = rel.replace(/\.(get|post|put|patch|delete|head|options)?\.ts$/, '')
  const withoutIndex = withoutExt.replace(/\/index$/, '')
  const segments = withoutIndex
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (/^\[\.\.\..+\]$/.test(segment)) return '**'
      return segment.replace(/^\[(.+)\]$/, ':$1')
    })

  return { route: `/api/${segments.join('/')}`, methods, file: relative(file) }
}

function checkEveryRouteClassified() {
  const unmapped = []
  const misclassified = []
  const counts = { permission: 0, login: 0, public: 0 }
  let routes = 0

  for (const file of walk(API_DIR).sort()) {
    const rel = relative(file)
    const registered = NON_ROUTE_MODULES.get(rel)

    if (registered) {
      if (isRouteModule(file)) {
        misclassified.push(`${rel} 被登记为非路由模块，却含 defineEventHandler / default export（登记已过期）`)
      }
      continue
    }

    if (!isRouteModule(file)) {
      misclassified.push(`${rel} 不是路由模块（无 defineEventHandler / default export）且未登记 —— 请迁出 api 目录或加入 NON_ROUTE_MODULES`)
      continue
    }

    const { route, methods } = describeRouteFile(file)
    for (const method of methods) {
      const decision = classifyApiRoute(method, route)
      if (decision.decision === 'unmapped') {
        unmapped.push(`${method} ${route}（${rel}）`)
      } else {
        counts[decision.decision] += 1
      }
      routes += 1
    }
  }

  assert.equal(misclassified.length, 0, `api 目录组织问题：\n  ${misclassified.join('\n  ')}`)
  assert.equal(
    unmapped.length,
    0,
    `以下路由未被 routePermissionMap 分类（运行时按拒绝处理，等于静默 403）：\n  ${unmapped.join('\n  ')}`
  )
  assert.ok(routes > 0, 'server/api 下未发现任何路由文件')
  assert.ok(
    counts.permission > 0 && counts.login > 0 && counts.public > 0,
    `分类统计异常：${JSON.stringify(counts)}`
  )
  return { routes, counts }
}

function checkRuleKeys() {
  const invalid = validateRouteRules()
  assert.equal(invalid.length, 0, `规则表出现 catalog 之外的 key：\n  ${invalid.join('\n  ')}`)

  const openKeys = [...new Set(OPEN_ROUTE_RULES.map((rule) => rule.key))]
  for (const key of openKeys) {
    assert.ok(isPermissionKey(key), `open 规则 key 不在 catalog：${key}`)
    assert.ok(
      API_PERMISSION_KEYS.includes(key),
      `open 规则 key 必须是 API 权限（isApiPermission=true）：${key}`
    )
  }
}

function checkMandatedPaths() {
  const songs = classifyApiRoute('GET', '/api/open/songs')
  assert.equal(songs.decision, 'permission')
  assert.equal(songs.permission, 'song.read', '/api/open/songs 必须映射到 song.read')

  const schedules = classifyApiRoute('GET', '/api/open/schedules')
  assert.equal(schedules.decision, 'permission')
  assert.equal(schedules.permission, 'schedule.read', '/api/open/schedules 必须映射到 schedule.read')
}

function checkRuleOrdering() {
  const samples = [
    ['PUT', '/api/admin/users/batch-status', 'user.status'],
    ['PUT', '/api/admin/users/123/status', 'user.status'],
    ['POST', '/api/admin/users/123/approval', 'user.status'],
    ['POST', '/api/admin/users/123/reset-password', 'user.manage'],
    ['GET', '/api/admin/users/123', 'user.read'],
    ['POST', '/api/admin/card-codes/delete', 'card_codes.delete'],
    ['GET', '/api/admin/card-codes/export', 'card_codes.read'],
    ['POST', '/api/admin/backup/restore', 'backup.restore'],
    ['POST', '/api/admin/backup/restore-chunk', 'backup.restore'],
    ['POST', '/api/admin/backup/export', 'backup.export'],
    ['GET', '/api/admin/backup/download/x.sql', 'backup.export'],
    ['POST', '/api/admin/backup/upload', 'backup.execute'],
    ['POST', '/api/admin/schedule/publish', 'schedule.publish'],
    ['GET', '/api/admin/schedule/full', 'schedule.read'],
    ['POST', '/api/admin/songs/reject', 'song.reject'],
    ['POST', '/api/admin/songs/delete', 'song.write'],
    ['GET', '/api/admin/db-status', 'system_settings.read'],
    ['POST', '/api/admin/fix-sequence', 'database.reset'],
    ['POST', '/api/admin/database/reset', 'database.reset']
  ]

  const wrong = []
  for (const [method, pathname, expected] of samples) {
    const decision = classifyApiRoute(method, pathname)
    if (decision.permission !== expected) {
      wrong.push(
        `${method} ${pathname} → ${String(decision.permission)}（期望 ${expected}，决策 ${decision.decision}）`
      )
    }
  }
  assert.equal(wrong.length, 0, `规则顺序 / 映射不符合预期（第一条命中胜出）：\n  ${wrong.join('\n  ')}`)
}

export const checks = [
  { name: '路由覆盖 A：server/api 每条路由都必须被显式分类', run: checkEveryRouteClassified },
  { name: '路由覆盖 B：规则 key 合法，且 open 规则只使用 API 权限', run: checkRuleKeys },
  { name: '路由覆盖 C：/api/open/songs 与 /api/open/schedules 精确覆盖', run: checkMandatedPaths },
  { name: '路由覆盖 D：顺序敏感抽查（第一条命中胜出）', run: checkRuleOrdering }
]
