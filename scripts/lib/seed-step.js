/**
 * 唯一迁移链的「seed 步骤」共享实现（S1-3 / S1-5 · D5 / R-21）。
 *
 * 三个迁移入口（`safe-migrate.js` / `db-sync.js` / `deploy.js`）在迁移完成后都必须调用本模块，
 * 保证「迁移成功 ⇒ 权限数据就位」；seed 脚本缺失或执行失败一律抛错/非零退出，
 *
 * **严禁** fileExists 家族的静默跳过（R-21）：历史上「seed 文件不在就跳过」让权限表
 * 长期为空、全部管理接口 403，且部署日志显示成功。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** seed 入口（相对仓库根；`pnpm db:seed` 与唯一迁移链指向同一文件） */
export const SEED_SCRIPT = 'scripts/seed-permissions.js'

/** 校验 seed 脚本存在；缺失直接抛错，绝不静默跳过 */
export function assertSeedScript() {
  const seedPath = path.resolve(process.cwd(), SEED_SCRIPT)
  if (!fs.existsSync(seedPath)) {
    throw new Error(`seed 脚本缺失：${SEED_SCRIPT} —— 拒绝静默跳过（见 AGENTS.md 迁移约定）`)
  }
  return seedPath
}

/** 同步执行 seed；非零退出即抛出，由调用方决定整体退出码 */
export function runSeedStep() {
  const seedPath = assertSeedScript()
  execFileSync(process.execPath, [seedPath], { stdio: 'inherit', env: process.env })
}
