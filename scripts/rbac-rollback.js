#!/usr/bin/env node

/**
 * 数据层回滚执行器（S1-8 · D1 / R-36）。
 *
 * `pnpm rbac:rollback` → 在 DATABASE_URL 上执行 `scripts/rbac-rollback.sql`：
 * 与 `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rbac-rollback.sql` 等价，
 * 但不依赖机器上装了 psql（本仓库的测试/部署环境不保证有客户端）。
 *
 * SQL 文件本身负责 BEGIN/COMMIT 与幂等（全 IF EXISTS），执行后这里再做一次核对：
 * 8 张表与 api_keys 8 列必须都已消失，否则非零退出（防止「脚本跑完但没生效」的假绿）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import postgres from 'postgres'

config({ path: path.resolve(process.cwd(), '.env') })

/** 回滚覆盖的对象清单（与 scripts/rbac-rollback.sql 的 DROP 列表一致） */
const DROPPED_TABLES = [
  'user_permissions',
  'role_permissions',
  'permissions',
  'permission_migration_log',
  'webhook_failures',
  'api_usage_monthly',
  'api_usage_daily',
  'api_rate_limit_counters'
]
const DROPPED_COLUMNS = [
  'ownerType',
  'ownerId',
  'rateLimitPerMinute',
  'quotaDaily',
  'quotaMonthly',
  'ipWhitelist',
  'webhookUrl',
  'webhookSecretHash'
]

const log = (message) => console.log(`[rbac-rollback] ${message}`)

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('未设置 DATABASE_URL（读 .env 或环境变量）：拒绝静默跳过')
  }

  const sqlPath = path.resolve(process.cwd(), 'scripts', 'rbac-rollback.sql')
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`回滚 SQL 缺失：${sqlPath} —— 拒绝静默跳过`)
  }

  const rollbackSql = fs.readFileSync(sqlPath, 'utf8')
  const sql = postgres(process.env.DATABASE_URL, { max: 1 })

  try {
    log('执行 scripts/rbac-rollback.sql（幂等，全 IF EXISTS）…')
    await sql.unsafe(rollbackSql)

    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${DROPPED_TABLES}::text[])
      ORDER BY table_name
    `
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'api_keys'
        AND column_name = ANY(${DROPPED_COLUMNS}::text[])
      ORDER BY column_name
    `

    if (tables.length > 0 || columns.length > 0) {
      throw new Error(
        `回滚不完整 —— 残留表：${tables.map((r) => r.table_name).join(', ') || '无'}；` +
          `残留列：${columns.map((r) => r.column_name).join(', ') || '无'}`
      )
    }

    const meta = await sql`
      SELECT count(*)::int AS count
      FROM public.__drizzle_migrations__
    `.catch(() => [{ count: 0 }])

    log(`✔ 8 张表与 api_keys 8 列已全部移除；记账表剩余 ${meta[0].count} 条（原 53 条）`)
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(`[rbac-rollback] ✖ ${error.message || error}`)
  process.exit(1)
})
