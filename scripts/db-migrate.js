#!/usr/bin/env node

/**
 * 唯一迁移链入口（S1-5 · D5 / R-21 / R-22）。
 *
 * 链：① 校验 DATABASE_URL → ② `drizzle-kit migrate` → ③ seed（catalog → permissions / role_permissions）
 *
 * 约定（与 AGENTS.md §4.2 一致）：
 *   - 本脚本**只迁移不生成**：迁移文件必须显式跑 `pnpm db:generate` 才会产出，
 *     禁止在部署/迁移路径上隐式 generate（会产生时间戳漂移的迁移）。
 *   - `pnpm db:migrate` / `pnpm setup` 都指向本脚本；`safe-migrate` / `db-sync` / `deploy`
 *     也复用同一 seed 步骤（scripts/lib/seed-step.js），保证「迁移成功 ⇒ 权限数据就位」。
 *   - 任一步失败 → 整体非零退出，不做静默降级。
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { SEED_SCRIPT, assertSeedScript } from './lib/seed-step.js'

config({ path: path.resolve(process.cwd(), '.env') })

const DRIZZLE_KIT_BIN = path.resolve(process.cwd(), 'node_modules', 'drizzle-kit', 'bin.cjs')

const log = (message) => console.log(`[db-migrate] ${message}`)

function step(title, args) {
  log(title)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env })
  if (result.error) {
    console.error(`[db-migrate] ✖ 无法执行：${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`[db-migrate] ✖ 上一步以退出码 ${result.status} 结束，链路中止`)
    process.exit(result.status ?? 1)
  }
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[db-migrate] ✖ 未设置 DATABASE_URL（读 .env 或环境变量）：拒绝静默跳过')
    process.exit(1)
  }
  if (!fs.existsSync(DRIZZLE_KIT_BIN)) {
    console.error(`[db-migrate] ✖ 未找到 drizzle-kit（${DRIZZLE_KIT_BIN}），请先 pnpm install`)
    process.exit(1)
  }

  step('① drizzle-kit migrate', [DRIZZLE_KIT_BIN, 'migrate'])

  // seed 文件缺失/失败都必须让整条链失败（R-21）
  const seedPath = assertSeedScript()
  step(`② seed（${SEED_SCRIPT}）`, [seedPath])

  log('✔ 迁移链完成：schema 已同步，权限数据已幂等就位')
}

try {
  main()
} catch (error) {
  console.error(`[db-migrate] ✖ ${error.message || error}`)
  process.exit(1)
}
