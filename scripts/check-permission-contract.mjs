/**
 * 权限契约检查跑器（S0 只落占位语义，S1-6 起填实）。
 *
 * 机制：扫描 scripts/contract-checks/*.mjs，每个模块导出
 *   export const checks = [{ name: string, run: () => void | Promise<void> }]
 * 全部通过 → exit 0；任一失败 → 收集后 exit 1。
 *
 * 目录不存在时按「无 check 注册」处理（打印提示后 exit 0）——该目录由 S1-6 首次创建，
 * S0 阶段必须能独立跑通。
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, repoPath, fail, ok } from './lib/gate-utils.mjs'

const CHECKS_DIR = repoPath('scripts', 'contract-checks')

async function main() {
  if (!fs.existsSync(CHECKS_DIR)) {
    // S0 阶段目录尚未创建（S1-6 才建），这是合法状态
    console.log('no checks registered')
    return
  }

  const files = fs
    .readdirSync(CHECKS_DIR)
    .filter((name) => name.endsWith('.mjs'))
    .sort()

  if (files.length === 0) {
    // 目录已存在却没有 check —— 视为假绿风险（check 未加载 / 文件名不对），必须失败
    return fail(`目录 ${CHECKS_DIR} 已存在但没有 .mjs check 模块 —— 拒绝判定通过`)
  }

  let passed = 0
  const failures = []

  for (const file of files) {
    const fullPath = path.join(CHECKS_DIR, file)
    let module
    try {
      // 必须用 file:// URL：Windows 裸路径会被 ESM loader 拒绝；同时绕开快照缓存
      module = await import(pathToFileURL(fullPath).href)
    } catch (err) {
      failures.push(`${file}: 模块加载失败 - ${err.message}`)
      continue
    }

    const checks = Array.isArray(module.checks) ? module.checks : []
    if (checks.length === 0) {
      failures.push(`${file}: 未导出 checks 数组`)
      continue
    }

    for (const check of checks) {
      try {
        await check.run()
        passed += 1
        console.log(`  ✔ ${file} :: ${check.name}`)
      } catch (err) {
        failures.push(`${file} :: ${check.name}: ${err.message}`)
      }
    }
  }

  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✖ ${f}`)
    return fail(`contract: ${passed} passed, ${failures.length} failed module(s)`)
  }
  ok(`contract: ${passed} checks passed (${files.length} module(s))`)
}

main().catch((err) => fail(`contract 跑器异常：${err.stack || err.message}`))

void ROOT
