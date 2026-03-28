#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env') })

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}
const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`)
const ok = (msg) => log(`✅ ${msg}`, 'green')
const warn = (msg) => log(`⚠️  ${msg}`, 'yellow')
const err = (msg) => log(`❌ ${msg}`, 'red')

const NON_INTERACTIVE_ENV = {
  ...process.env,
  CI: 'true',
  DRIZZLE_KIT_FORCE: 'true',
  DRIZZLE_KIT_NON_INTERACTIVE: 'true',
  NODE_ENV: process.env.NODE_ENV || 'production'
}

function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options })
    return true
  } catch (e) {
    return false
  }
}

function fileExists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function ensureDrizzleFiles() {
  if (!fileExists('drizzle.config.ts')) throw new Error('Drizzle 配置文件不存在')
  if (!fileExists('app/drizzle/schema.ts')) throw new Error('Schema 文件不存在')
}

function isEmptyDatabase() {
  try {
    const output = execSync('pnpm exec drizzle-kit introspect --config=drizzle.config.ts', {
      stdio: 'pipe',
      env: NON_INTERACTIVE_ENV,
      encoding: 'utf8'
    })
    const tablesMatch = output.match(/(\d+)\s+tables/i)
    const hasTablesCount = tablesMatch && Number(tablesMatch[1]) > 0
    const listsTables = /\bcolumns\b|\bindexes\b|\bfks\b/i.test(output)
    return !(hasTablesCount || listsTables)
  } catch {
    warn('无法检测数据库状态，按非空库处理')
    return false
  }
}

// 检查数据库schema是否与代码中的schema一致
function checkSchemaConsistency() {
  try {
    // 使用 drizzle-kit introspect 获取当前数据库schema
    const output = execSync('pnpm exec drizzle-kit introspect --config=drizzle.config.ts', {
      stdio: 'pipe',
      env: NON_INTERACTIVE_ENV,
      encoding: 'utf8'
    })

    // 检查关键表和字段是否存在
    const checks = [
      { pattern: /"status".*user_status/i, name: 'user_status enum type' },
      { pattern: /"api_keys"/i, name: 'api_keys table' }
    ]

    const missing = []
    for (const check of checks) {
      if (!check.pattern.test(output)) {
        missing.push(check.name)
      }
    }

    if (missing.length > 0) {
      warn(`检测到数据库schema不完整，缺少: ${missing.join(', ')}`)
      return false
    }

    return true
  } catch (e) {
    warn('无法检测数据库schema一致性')
    return true // 出错时不阻止继续
  }
}

function main() {
  log('🔄 数据库同步', 'cyan')

  if (!process.env.DATABASE_URL) {
    warn('未设置 DATABASE_URL')
    process.exit(0)
  }

  ensureDrizzleFiles()

  const emptyDb = isEmptyDatabase()
  if (emptyDb) {
    log('🆕 检测到空库，执行迁移 (migrate)...', 'cyan')
    if (!safeExec('pnpm run db:migrate', { env: NON_INTERACTIVE_ENV })) {
      err('数据库迁移失败')
      process.exit(1)
    }
    ok('空库迁移完成')
  } else {
    log('🔁 检测到非空库，检查schema一致性...', 'cyan')

    // 检查数据库schema是否与代码一致
    const schemaConsistent = checkSchemaConsistency()

    if (!schemaConsistent) {
      warn('数据库schema不完整，尝试使用 push --force 进行修复...', 'cyan')
      const pushCommand = 'pnpm exec drizzle-kit push --force --config=drizzle.config.ts'
      if (
        !safeExec(pushCommand, {
          env: { ...NON_INTERACTIVE_ENV, DRIZZLE_KIT_NON_INTERACTIVE: 'true' }
        })
      ) {
        err('数据库schema修复失败')
        process.exit(1)
      }
      ok('schema修复成功')
    } else {
      log('🔁 数据库schema一致，尝试执行 migrate 同步...', 'cyan')

      // 尝试执行 migrate
      const migrateSuccess = safeExec('pnpm run db:migrate', {
        env: { ...NON_INTERACTIVE_ENV, DRIZZLE_KIT_NON_INTERACTIVE: 'true' }
      })

      if (migrateSuccess) {
        ok('migrate 同步成功')
      } else {
        warn('migrate 同步失败，可能是由于数据库结构与迁移记录不一致。')
        log('🔄 尝试使用 push --force 进行强制同步...', 'cyan')

        // 在 CI 环境下，push 命令如果遇到重命名等歧义可能会弹出交互式提示
        // 确保 DRIZZLE_KIT_NON_INTERACTIVE 已设置
        const pushCommand = 'pnpm exec drizzle-kit push --force --config=drizzle.config.ts'
        if (
          !safeExec(pushCommand, {
            env: { ...NON_INTERACTIVE_ENV, DRIZZLE_KIT_NON_INTERACTIVE: 'true' }
          })
        ) {
          err('数据库同步完全失败。请检查数据库连接或手动运行 pnpm exec drizzle-kit push 以解决歧义。')
          process.exit(1)
        }
        ok('强制同步 (push) 成功')
      }
    }
  }

  ok('数据库同步流程完成')
}

try {
  main()
} catch (e) {
  err(`同步异常: ${e.message || e}`)
  process.exit(1)
}
