/**
 * 契约检查 · RBAC 内核隔离（S2-4 建立 / S3-B1 升级 · R-26 / R-41）。
 *
 * A. **依赖面收敛**：`server/api/**` 只允许 import 内核的**公共入口**（`~~/server/utils/rbac`），
 *    禁止深层 import 实现文件（`.../rbac/resolvePermissions` 之类）。
 *    为什么从「零引用」改为「只允许公共入口」：S2 阶段的内核零调用方是**该片的判据**
 *    （证明部署后行为不变，证据见 tools/server/verification-s2.md），而 S3 的使命就是把路由接到内核上；
 *    不变的是架构约束 —— 路由只依赖公共 API，实现细节（解析/缓存/legacy 兜底）不得被路由直接触达。
 * B. 权限解析只有一条权威实现：
 *    - `resolveUserPermissions` 只在 `server/utils/rbac/resolvePermissions.ts` 定义；
 *    - 除内核外，`server/**` 不得直接查 `role_permissions` / `user_permissions` 表。
 * C. `server/utils/rbac/**` 内不得出现第二份 catalog key 字面量（R-32）。
 * D. legacy 回滚路径必须从 catalog 派生（R-25 的回归护栏）：
 *    - `legacyRoleCheck.ts` 必须用 `roleHasPermission`，且不得自带 min-role 映射表；
 *    - `guards.ts` 里 `requirePermission` 与 `requireAnyPermission` 都必须分叉 `isRbacEnabled()`。
 *
 * 跑器：`node scripts/check-permission-contract.mjs`。
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { PERMISSION_KEYS } from '../../shared/rbac/permission-catalog.js'

const ROOT = process.cwd()
const KERNEL_DIR = path.join(ROOT, 'server', 'utils', 'rbac')
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'coverage'])
const SCAN_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cts', '.mts'])

const relative = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/')

/** 剥注释：注释里解释「谁提到 role_permissions」「minRole 如 role.manage」都不是违规 */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

function walk(dir, collected = []) {
  if (!fs.existsSync(dir)) return collected
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), collected)
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      collected.push(path.join(dir, entry.name))
    }
  }
  return collected
}

function checkApiKernelDependencySurface() {
  const violations = []
  for (const file of walk(path.join(ROOT, 'server', 'api'))) {
    const text = stripComments(fs.readFileSync(file, 'utf8'))
    const specifiers = [
      ...text.matchAll(/['"`]([^'"`]*(?:utils\/rbac|utils\\rbac)[^'"`]*)['"`]/g)
    ].map((match) => match[1])
    for (const specifier of specifiers) {
      const rest = (specifier.split(/utils[\\/]rbac/)[1] ?? '').replace(/\.ts$/, '')
      const allowed = rest === '' || rest === '/index'
      if (!allowed) violations.push(`${relative(file)} → ${specifier}`)
    }
  }
  assert.equal(
    violations.length,
    0,
    `server/api 只能依赖内核公共入口（~~/server/utils/rbac），禁止深层 import 实现文件：\n  ${violations.join('\n  ')}`
  )
}

function checkSingleAuthority() {
  const serverFiles = walk(path.join(ROOT, 'server'))

  const definitions = serverFiles
    .filter((file) => {
      const text = fs.readFileSync(file, 'utf8')
      return /function\s+resolveUserPermissions\s*\(|const\s+resolveUserPermissions\s*=/.test(text)
    })
    .map(relative)
    .sort()

  assert.deepEqual(
    definitions,
    ['server/utils/rbac/resolvePermissions.ts'],
    `resolveUserPermissions 必须只有一个权威实现，实际：${definitions.join(', ') || '（无）'}`
  )

  const tableReaders = serverFiles
    .filter((file) =>
      // 负向断言排除 `user_permissions.manage` 这类**权限 key**（后面紧跟点号），只匹配表引用
      /\brole_permissions\b(?!\.)|\buser_permissions\b(?!\.)/.test(stripComments(fs.readFileSync(file, 'utf8')))
    )
    .map(relative)
    .sort()

  assert.deepEqual(
    tableReaders,
    ['server/utils/rbac/resolvePermissions.ts'],
    `除内核外不得直查角色矩阵 / 个人加授表（唯一权威解析）：${tableReaders.join(', ') || '（无）'}`
  )
}

function checkNoSecondLiteralCopy() {
  const escaped = PERMISSION_KEYS.map((key) => key.replace(/\./g, '\\.')).join('|')
  const pattern = new RegExp(`['"\`](${escaped})['"\`]`)
  const violations = []
  for (const file of walk(KERNEL_DIR)) {
    const text = stripComments(fs.readFileSync(file, 'utf8'))
    const match = pattern.exec(text)
    if (match) violations.push(`${relative(file)} → ${match[1]}`)
  }
  assert.equal(
    violations.length,
    0,
    `内核内出现 catalog key 字面量（应走 PERMISSIONS.* / minRoleOf / roleHasPermission）：${violations.join('；')}`
  )
}

function checkLegacyDerivesFromCatalog() {
  const legacyText = fs.readFileSync(path.join(KERNEL_DIR, 'legacyRoleCheck.ts'), 'utf8')
  assert.ok(
    legacyText.includes('roleHasPermission'),
    'legacyRoleCheck.ts 必须用 catalog 派生的 roleHasPermission（禁止第二份 minRole 表）'
  )
  assert.equal(
    /Record<\s*PermissionKey\s*,\s*Role\s*>/.test(legacyText),
    false,
    'legacyRoleCheck.ts 不得自带 min-role 映射表（上一轮的漂移源）'
  )

  const guardsText = fs.readFileSync(path.join(KERNEL_DIR, 'guards.ts'), 'utf8')
  const branches = guardsText.match(/isRbacEnabled\(\)/g) ?? []
  assert.ok(
    branches.length >= 2,
    `requirePermission / requireAnyPermission 都必须分叉 isRbacEnabled（R-25），实际出现 ${branches.length} 次`
  )
}

export const checks = [
  { name: '内核隔离 A：server/api 只依赖内核公共入口（禁止深层 import）', run: checkApiKernelDependencySurface },
  { name: '内核隔离 B：权限解析唯一权威实现（含无第二份表直查）', run: checkSingleAuthority },
  { name: '内核隔离 C：内核目录内零 catalog key 字面量', run: checkNoSecondLiteralCopy },
  { name: '内核隔离 D：legacy 走 catalog 派生 + 两个 require* 都分叉开关', run: checkLegacyDerivesFromCatalog }
]
