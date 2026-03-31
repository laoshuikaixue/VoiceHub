#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import { config } from 'dotenv'
import path from 'path'

// 加载环境变量（从项目根目录）
config({ path: path.resolve(process.cwd(), '.env') })

// 如果设置了 PREBUILT=true，则自动跳过安装和构建
if (process.env.PREBUILT === 'true') {
  process.env.SKIP_INSTALL = 'true'
  process.env.SKIP_BUILD = 'true'
}

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}
const BUILD_MEMORY_MB = 6144
const DEFAULT_NODE_OPTIONS = `--max-old-space-size=${BUILD_MEMORY_MB}`

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  log(`${step} ${message}`, 'cyan')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

// 安全执行命令
function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options })
    return true
  } catch (error) {
    return false
  }
}

// 检查环境变量
function checkEnvironment() {
  logStep('🔍', '检查环境配置...')

  const requiredEnvVars = ['DATABASE_URL']
  const missingVars = []

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName)
    }
  })

  if (missingVars.length > 0) {
    logError(`缺少必需的环境变量: ${missingVars.join(', ')}`)
    logError('请通过以下方式之一设置环境变量：')
    logError('1. 创建 .env 文件并配置 DATABASE_URL')
    logError('2. 使用 docker run -e DATABASE_URL=xxx 传递环境变量')
    logError('3. 在 docker-compose.yml 中配置 environment')
    throw new Error('环境变量配置不完整')
  } else {
    logSuccess('环境变量检查通过')
  }

  return true
}

// 主部署流程
async function deploy() {
  log('🚀 开始部署...', 'cyan')

  try {
    // 0. 检查环境（必须通过）
    checkEnvironment()

    // 1. 安装依赖
    if (process.env.SKIP_INSTALL === 'true') {
      logStep('📦', '跳过依赖安装 (SKIP_INSTALL=true)...')
    } else {
      logStep('📦', '安装依赖...')
      let installed = false

      // 优先尝试 pnpm install --frozen-lockfile
      if (fileExists('pnpm-lock.yaml')) {
        log('尝试使用 pnpm install --frozen-lockfile 安装...', 'cyan')
        if (safeExec('pnpm install --frozen-lockfile')) {
          installed = true
          logSuccess('依赖安装完成 (pnpm install --frozen-lockfile)')
        } else {
          logWarning('pnpm install --frozen-lockfile 安装失败，准备回退到 pnpm install...')
        }
      } else {
        logWarning('未检测到 pnpm-lock.yaml，跳过冻结锁文件安装，直接使用 pnpm install...')
      }

      // 如果冻结锁文件安装没运行或失败，使用 pnpm install
      if (!installed) {
        log('正在使用 pnpm install 安装...', 'cyan')
        if (!safeExec('pnpm install')) {
          throw new Error('依赖安装失败')
        }
        logSuccess('依赖安装完成 (pnpm install)')
      }
    }

    // 2. 检查 Drizzle 配置
    if (
      !fileExists('drizzle.config.ts') ||
      !fileExists('app/drizzle/schema.ts') ||
      !fileExists('app/drizzle/db.ts')
    ) {
      throw new Error('Drizzle 配置文件不完整')
    }

    // 2.1. 确保迁移目录存在
    if (!fileExists('app/drizzle/migrations')) {
      fs.mkdirSync('app/drizzle/migrations', { recursive: true })
    }

    // 3. 数据库同步
    logStep('🗄️', '同步数据库...')
    let dbSyncSuccess = false
    if (process.env.DATABASE_URL) {
      const nonInteractiveEnv = {
        ...process.env,
        DRIZZLE_KIT_FORCE: 'true',
        CI: 'true',
        NODE_ENV: 'production'
      }
      if (safeExec('node scripts/db-sync.js', { env: nonInteractiveEnv })) {
        logSuccess('数据库同步成功')
        dbSyncSuccess = true
      } else {
        logWarning('数据库同步失败')
      }
    } else {
      logWarning('未设置 DATABASE_URL，跳过数据库迁移')
    }

    // 4. 创建管理员账户
    if (fileExists('scripts/create-admin.js') && dbSyncSuccess) {
      logStep('👤', '检查管理员账户...')
      safeExec('pnpm run create-admin')
    }

    // 5. 构建应用
    if (process.env.SKIP_BUILD === 'true') {
      logStep('🔨', '跳过应用构建 (SKIP_BUILD=true)...')
    } else {
      logStep('🔨', '构建应用...')
      const buildEnv = {
        ...process.env,
        NODE_OPTIONS: process.env.NODE_OPTIONS || DEFAULT_NODE_OPTIONS
      }
      if (!safeExec('pnpm exec nuxt build', { env: buildEnv })) {
        throw new Error('应用构建失败')
      }
      logSuccess('应用构建完成')
    }

    log('🎉 部署完成！', 'green')
  } catch (error) {
    logError(`部署失败: ${error.message}`)
    process.exit(1)
  }
}

// 运行部署
deploy().catch((error) => {
  logError(`未预期的错误: ${error.message}`)
  process.exit(1)
})
