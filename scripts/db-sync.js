#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'
config({ path: path.resolve(process.cwd(), '.env') })

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m'
}
const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`)
const ok = (msg) => log(`✅ ${msg}`, 'green')
const warn = (msg) => log(`⚠️ ${msg}`, 'yellow')
const err = (msg) => log(`❌ ${msg}`, 'red')

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
  } catch (e) {
    return false
  }
}

function fileExists(p) {
  try { return fs.existsSync(p) } catch { return false }
}

function ensureDrizzleFiles() {
  if (!fileExists('drizzle.config.ts')) throw new Error('Drizzle 配置文件不存在: drizzle.config.ts')
  if (!fileExists('drizzle/schema.ts')) throw new Error('Drizzle schema 文件不存在: drizzle/schema.ts')
}

function isEmptyDatabase() {
  try {
    const output = execSync('npx drizzle-kit introspect --config=drizzle.config.ts', {
      stdio: 'pipe', env: NON_INTERACTIVE_ENV, encoding: 'utf8'
    })
    const tablesMatch = output.match(/(\d+)\s+tables/i)
    const hasTablesCount = tablesMatch && Number(tablesMatch[1]) > 0
    const listsTables = /\bcolumns\b|\bindexes\b|\bfks\b/i.test(output)
    return !(hasTablesCount || listsTables)
  } catch {
    // introspect 失败时，保守认为“非空库”，避免重复建表
    warn('introspect 失败，按非空库处理')
    return false
  }
}

function main() {
  log('🔄 开始统一的数据库同步流程', 'bright')

  if (!process.env.DATABASE_URL) {
    warn('未设置 DATABASE_URL，跳过数据库迁移')
    process.exit(0)
  }

  ensureDrizzleFiles()

  const emptyDb = isEmptyDatabase()
  if (emptyDb) {
    log('🆕 检测到空库，执行迁移 (migrate)...', 'cyan')
    if (!safeExec('npm run db:migrate', { env: NON_INTERACTIVE_ENV })) {
      err('数据库迁移失败')
      process.exit(1)
    }
    ok('空库迁移完成')
  } else {
    log('🔁 检测到非空库，优先使用 push 同步...', 'cyan')
    if (safeExec('npx drizzle-kit push --force --config=drizzle.config.ts', { env: NON_INTERACTIVE_ENV })) {
      ok('push 同步成功')
    } else {
      warn('push 同步失败，回退到 migrate')
      if (!safeExec('npm run db:migrate', { env: NON_INTERACTIVE_ENV })) {
        err('数据库迁移完全失败')
        process.exit(1)
      }
      ok('回退迁移成功')
    }
  }

  ok('数据库同步流程完成')
}

try {
  main()
} catch (e) {
  err(`同步流程异常: ${e.message || e}`)
  process.exit(1)
}
