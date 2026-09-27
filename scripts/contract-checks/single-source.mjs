/**
 * 契约检查 · 权限 key 单一来源（S1-6 · R-32）。
 *
 * 两类扫描：
 *   A. catalog key（点分形）字面量只允许出现在权威定义与其薄 re-export / 契约检查自身；
 *      server、app、scripts、shared、tests 全覆盖（新增消费者必须 import，不得抄字面量）。
 *   B. legacy 冒号字面量（8 条）的消费方允许名单**只减不增**：名单里的文件一旦不再包含
 *      这些字面量（说明该切片已改走 catalog），本检查会失败提醒从名单里删除该条目——
 *      避免允许名单永久沦为「历史遗留」的藏身处（R-37：不许用「历史遗留」豁免）。
 */

import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { LEGACY_PERMISSION_MAP, PERMISSION_KEYS } from '../../shared/rbac/permission-catalog.js'

const ROOT = process.cwd()

/** 扫描范围（相对仓库根） */
const SCAN_DIRS = ['server', 'app', 'scripts', 'shared', 'tests']

/** 允许出现 catalog key 字面量的位置（各有明确理由，禁止无理由扩张） */
const LITERAL_ALLOWLIST = [
  'shared/rbac/permission-catalog.js', // 唯一权威定义本身
  'server/utils/rbac/constants.ts', // 薄 re-export（零字面量由 catalog.mjs 另行断言）
  'scripts/contract-checks/', // 契约检查的冻结期望值（见 legacy-map.mjs 顶部说明）
  'tests/contract/' // 冻结基线测试
]

/** 待迁移的 legacy 冒号字面量消费方（唯一属主见 planning/plan/TASKS.md；标 `未排期` 者为本轮写范围缺口） */
const LEGACY_CONSUMERS = [
  { file: 'server/middleware/api-auth.ts', owner: 'S5-4' },
  { file: 'server/config/constants.ts', owner: 'S5-5' },
  { file: 'server/api/admin/api-keys/permissions.ts', owner: 'S5-5' },
  { file: 'app/components/Admin/ApiKeyManager.vue', owner: 'S5-6' },
  { file: 'server/api/user/api-keys/index.get.ts', owner: '未排期（S1 偏差 D-S1-a）' },
  { file: 'server/api/user/api-keys/index.post.ts', owner: '未排期（S1 偏差 D-S1-a）' },
  { file: 'server/api/user/api-keys/[id].delete.ts', owner: '未排期（S1 偏差 D-S1-a）' },
  { file: 'server/api/user/api-keys/[id]/logs.get.ts', owner: '未排期（S1 偏差 D-S1-a）' }
]

const LEGACY_ALLOWLIST = [...LITERAL_ALLOWLIST, ...LEGACY_CONSUMERS.map((entry) => entry.file)]

const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'coverage'])
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.vue'])
const MAX_FILE_BYTES = 2 * 1024 * 1024

function walk(dir, collected = []) {
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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const relative = (absolutePath) => path.relative(ROOT, absolutePath).split(path.sep).join('/')

const isAllowed = (relativePath, allowlist) =>
  allowlist.some((entry) => (entry.endsWith('/') ? relativePath.startsWith(entry) : relativePath === entry))

function listFiles() {
  const files = []
  for (const dir of SCAN_DIRS) {
    const absolute = path.join(ROOT, dir)
    if (fs.existsSync(absolute)) walk(absolute, files)
  }
  return files
}

function checkCatalogKeyLiterals() {
  const pattern = new RegExp(`['"\`](${PERMISSION_KEYS.map(escapeRegExp).join('|')})['"\`]`, 'g')
  const violations = []

  for (const file of listFiles()) {
    const relativePath = relative(file)
    if (isAllowed(relativePath, LITERAL_ALLOWLIST)) continue
    if (fs.statSync(file).size > MAX_FILE_BYTES) continue

    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length
      violations.push(`${relativePath}:${line} → ${match[1]}`)
    }
  }

  assert.equal(
    violations.length,
    0,
    `catalog key 出现第二份字面量（应改为 import catalog / constants.ts）：\n  ${violations.join('\n  ')}`
  )
}

function checkLegacyConsumersStillExist() {
  const stale = []
  const legacyLiterals = Object.keys(LEGACY_PERMISSION_MAP).map((key) => `'${key}'`)

  for (const entry of LEGACY_CONSUMERS) {
    const absolute = path.join(ROOT, entry.file)
    if (!fs.existsSync(absolute)) {
      stale.push(`${entry.file}（文件不存在）`)
      continue
    }
    const source = fs.readFileSync(absolute, 'utf8')
    if (!legacyLiterals.some((literal) => source.includes(literal))) {
      stale.push(`${entry.file}（已无 legacy 字面量，说明 ${entry.owner} 已迁移完成）`)
    }
  }

  assert.equal(
    stale.length,
    0,
    `legacy 消费方允许名单已过期，请从 single-source.mjs 删除：\n  ${stale.join('\n  ')}`
  )
}

function checkLegacyLiteralsOutsideAllowlist() {
  const legacyKeys = Object.keys(LEGACY_PERMISSION_MAP)
  const pattern = new RegExp(`['"\`](${legacyKeys.map(escapeRegExp).join('|')})['"\`]`, 'g')
  const violations = []

  for (const file of listFiles()) {
    const relativePath = relative(file)
    if (isAllowed(relativePath, LEGACY_ALLOWLIST)) continue
    if (fs.statSync(file).size > MAX_FILE_BYTES) continue

    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length
      violations.push(`${relativePath}:${line} → ${match[1]}`)
    }
  }

  assert.equal(
    violations.length,
    0,
    `legacy 冒号字面量出现在未登记的位置（新代码必须用 catalog key）：\n  ${violations.join('\n  ')}`
  )
}

export const checks = [
  { name: 'catalog key 字面量：server/app/scripts/shared/tests 无第二份', run: checkCatalogKeyLiterals },
  { name: 'legacy 消费方允许名单：只减不增（过期条目必须删除）', run: checkLegacyConsumersStillExist },
  { name: 'legacy 冒号字面量：只允许出现在名单内文件', run: checkLegacyLiteralsOutsideAllowlist }
]
