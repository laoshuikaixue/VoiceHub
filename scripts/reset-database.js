#!/usr/bin/env node

/**
 * 数据库完全重置脚本
 * 删除所有表（含迁移记录表），然后从头执行迁移
 * 使用方式: pnpm run db:reset
 */
import { execSync } from 'child_process'
import path from 'path'
import { config } from 'dotenv'
import postgres from 'postgres'

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}
const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`)
const ok = (msg) => log(`✅ ${msg}`, 'green')
const warn = (msg) => log(`⚠️  ${msg}`, 'yellow')
const err = (msg) => log(`❌ ${msg}`, 'red')

const args = process.argv.slice(2)
const forceFlag = args.includes('--force')

// 禁止在 CI 中执行（防止误触发导致生产库被清空）
if (process.env.CI && !forceFlag) {
  err('拒绝在 CI 环境中执行数据库重置；如确需强制，请使用 --force 标志并确认 CI 配置正确')
  process.exit(1)
}

if (!forceFlag) {
  err('危险操作：此脚本将清空整库数据')
  err('请添加 --force 标志确认执行：pnpm run db:reset -- --force')
  process.exit(1)
}

config({ path: path.resolve(process.cwd(), '.env') })

const NON_INTERACTIVE_ENV = {
  ...process.env,
  CI: 'true',
  DRIZZLE_KIT_FORCE: 'true',
  NODE_ENV: process.env.NODE_ENV || 'production'
}

function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options })
    return true
  } catch {
    return false
  }
}

function createSqlClient() {
  return postgres(process.env.DATABASE_URL, { max: 1 })
}

async function dropAllTables(sql) {
  log('获取 public schema 下所有表...', 'cyan')

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `

  if (tables.length === 0) {
    warn('没有找到任何表')
    return
  }

  log(`发现 ${tables.length} 张表，准备逐个删除（含 __drizzle_migrations__）...`, 'cyan')

  for (const row of tables) {
    const tableName = row.table_name
    await sql.unsafe(`DROP TABLE IF EXISTS "${tableName}" CASCADE`)
    log(`  - ${tableName}`, 'reset')
  }

  ok(`已删除 ${tables.length} 张表`)
}

async function dropAllEnums(sql) {
  log('清理枚举类型...', 'cyan')

  const enums = await sql`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
    ORDER BY t.typname
  `

  if (enums.length === 0) {
    return
  }

  for (const row of enums) {
    await sql.unsafe(`DROP TYPE IF EXISTS "${row.typname}" CASCADE`)
    log(`  - ${row.typname}`, 'reset')
  }

  ok(`已清理 ${enums.length} 个枚举类型`)
}

async function dropAllSequences(sql) {
  log('清理序列...', 'cyan')

  const sequences = await sql`
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `

  if (sequences.length === 0) {
    return
  }

  for (const row of sequences) {
    await sql.unsafe(`DROP SEQUENCE IF EXISTS "${row.sequence_name}"`)
    log(`  - ${row.sequence_name}`, 'reset')
  }

  ok(`已清理 ${sequences.length} 个序列`)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    err('未设置 DATABASE_URL 环境变量')
    process.exit(1)
  }

  log('⚠️  此操作将删除数据库所有表（含迁移记录），并从头重建', 'red')
  const dbUrl = (process.env.DATABASE_URL || '')
    .replace(/(postgresql:\/\/[^:@]+):[^@]+@/, '$1:***@')
    .replace(/(postgres:\/\/[^:@]+):[^@]+@/, '$1:***@')
  log(`目标数据库: ${dbUrl}`, 'cyan')
  log('🔄 开始数据库完全重置...', 'bright')

  const sql = createSqlClient()

  try {
    // 1. 删除所有表
    await dropAllTables(sql)

    // 2. 删除所有枚举
    await dropAllEnums(sql)

    // 3. 删除所有序列
    await dropAllSequences(sql)

    // 4. 从头执行迁移
    log('📋 从头执行数据库迁移...', 'cyan')
    if (!safeExec('pnpm run db:migrate', { env: NON_INTERACTIVE_ENV })) {
      err('数据库迁移失败')
      process.exit(1)
    }

    ok('数据库完全重置并迁移成功！')
    ok('数据库现已处于全新初始状态')
  } catch (error) {
    err(`重置失败: ${error.message || error}`)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  err(`未预期的错误: ${e.message || e}`)
  process.exit(1)
})