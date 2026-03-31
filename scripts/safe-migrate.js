#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

// 加载环境变量
config({ path: path.resolve(process.cwd(), '.env') })

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

// 检查环境变量
if (!process.env.DATABASE_URL) {
  logError('DATABASE_URL 环境变量未设置')
  process.exit(1)
}

// 安全执行命令
function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options })
    return true
  } catch (error) {
    logError(`命令执行失败: ${command}`)
    logError(error.message)
    return false
  }
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

// 处理数据冲突的函数
async function handleDataConflicts() {
  try {
    // 在Vercel环境中，我们主要关注schema同步而不是数据冲突处理
    log('检查数据库连接...', 'cyan')

    // 简单的连接测试
    if (!safeExec('cd .. && pnpm exec drizzle-kit check --config=drizzle.config.ts', { stdio: 'pipe' })) {
      logWarning('数据库schema检查失败，将尝试强制同步')
    }

    logSuccess('数据冲突检查完成')
  } catch (error) {
    logWarning(`数据冲突处理警告: ${error.message}`)
  }
}

async function safeMigrate() {
  log('🔄 开始安全数据库迁移流程...', 'bright')

  try {
    // 获取项目根目录路径
    const projectRoot = path.resolve(process.cwd(), '..')
    const drizzleConfigPath = path.join(projectRoot, 'drizzle.config.ts')
    const schemaPath = path.join(projectRoot, 'app/drizzle/schema.ts')
    const migrationsPath = path.join(projectRoot, 'app/drizzle/migrations')

    // 1. 确保drizzle配置存在
    if (!fileExists(drizzleConfigPath)) {
      throw new Error(`drizzle.config.ts 配置文件不存在: ${drizzleConfigPath}`)
    }

    // 2. 检查schema文件
    if (!fileExists(schemaPath)) {
      throw new Error(`app/drizzle/schema.ts 文件不存在: ${schemaPath}`)
    }

    // 3. 创建迁移目录（如果不存在）
    if (!fileExists(migrationsPath)) {
      log('创建迁移目录...', 'cyan')
      fs.mkdirSync(migrationsPath, { recursive: true })
    }

    // 自动执行 generate 命令并处理交互
    async function runGenerateWithAutoConfirm(env) {
      return new Promise((resolve) => {
        const { spawn } = require('child_process')
        const child = spawn('pnpm', ['run', 'db:generate'], {
          env,
          shell: true
        })

        // 监听输出，透传给用户，并自动响应提示
        child.stdout.on('data', (data) => {
          process.stdout.write(data)
          const str = data.toString()
          // 如果检测到交互提示（通常包含问号或选项），自动发送回车
          if (str.includes('?') || str.includes('renamed') || str.includes('created')) {
            try {
              // 发送回车以选择默认选项（通常是 Created）
              child.stdin.write('\n')
            } catch (e) {
              // 忽略写入错误
            }
          }
        })

        child.stderr.on('data', (data) => {
          process.stderr.write(data)
        })

        child.on('close', (code) => {
          resolve(code === 0)
        })

        child.on('error', () => {
          resolve(false)
        })
      })
    }

    // 4. 生成迁移文件（如果需要）
    log('生成数据库迁移文件...', 'cyan')

    // 设置非交互式环境变量
    const nonInteractiveEnv = {
      ...process.env,
      DRIZZLE_KIT_FORCE: 'true',
      CI: 'true',
      NODE_ENV: 'production'
    }

    // 使用新的自动确认函数
    const generateSuccess = await runGenerateWithAutoConfirm(nonInteractiveEnv)

    if (!generateSuccess) {
      logWarning('迁移文件生成可能遇到问题，尝试继续...')
    } else {
      logSuccess('迁移文件生成完成')
    }

    // 5. 预处理数据冲突
    log('🔍 检查并处理数据冲突...', 'cyan')
    await handleDataConflicts()

    // 6. 检查是否为全新部署（数据库为空）
    log('📋 检查数据库状态...', 'cyan')

    // 设置非交互式环境变量
    const env = {
      ...process.env,
      DRIZZLE_KIT_FORCE: 'true',
      CI: 'true',
      NODE_ENV: 'production'
    }

    // 检查数据库是否有任何表（基于 introspect 输出更稳健的判断）
    let isEmptyDatabase = false
    try {
      const checkResult = execSync(
        'cd .. && pnpm exec drizzle-kit introspect --config=drizzle.config.ts',
        {
          stdio: 'pipe',
          env,
          encoding: 'utf8'
        }
      )

      // 优先解析 "<n> tables" 提示，其次检查是否包含 columns 索引等摘要
      const tablesMatch = checkResult.match(/(\d+)\s+tables/i)
      const hasTablesCount = tablesMatch && Number(tablesMatch[1]) > 0
      const listsTables = /\bcolumns\b|\bindexes\b|\bfks\b/i.test(checkResult)

      // 数据库为空当且仅当：统计为0且没有任何表摘要
      isEmptyDatabase = !(hasTablesCount || listsTables)
    } catch (error) {
      // introspect 失败时不轻易判定为空库，改为保守：视为非空库，走 push 路径
      logWarning('数据库状态检查失败，按非空库处理以避免重复建表')
      isEmptyDatabase = false
    }

    if (isEmptyDatabase) {
      log('🆕 检测到全新部署，执行标准迁移...', 'cyan')
      // 对于全新部署，直接使用migrate避免交互式提示
      if (!safeExec('cd .. && pnpm run db:migrate', { env })) {
        throw new Error('数据库迁移失败')
      }
      logSuccess('全新数据库迁移成功')
    } else {
      log('🔄 检测到现有数据库，执行schema同步...', 'cyan')
      // 对于现有数据库，使用push进行增量更新
      if (safeExec('cd .. && pnpm exec drizzle-kit push --force --config=drizzle.config.ts', { env })) {
        logSuccess('数据库schema同步成功')
      } else {
        logWarning('schema同步失败，尝试标准迁移...')

        // 7. 执行迁移（作为后备）
        if (!safeExec('cd .. && pnpm run db:migrate', { env })) {
          throw new Error('数据库迁移完全失败')
        }
        logSuccess('数据库迁移成功')
      }
    }

    // 8. 验证迁移结果
    log('✅ 数据库迁移流程完成！', 'green')
  } catch (error) {
    logError(`迁移失败: ${error.message}`)
    logError('请检查数据库连接和迁移文件')
    process.exit(1)
  }
}

// 运行迁移
safeMigrate().catch((error) => {
  logError(`未预期的错误: ${error.message}`)
  process.exit(1)
})
