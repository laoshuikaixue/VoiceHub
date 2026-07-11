#!/usr/bin/env node

import { execSync, spawn } from 'child_process'
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

// Vercel 会在 buildCommand 前执行 installCommand，避免部署时重复安装全部依赖。
if (process.env.VERCEL) {
  process.env.SKIP_INSTALL = 'true'
}

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
}

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
  } catch {
    return false
  }
}

function execAsync(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const { signal, ...spawnOptions } = options
    let abortHandler
    let settled = false
    const finish = (success) => {
      if (settled) return
      settled = true
      if (signal && abortHandler) signal.removeEventListener('abort', abortHandler)
      resolve(success)
    }
    let child
    try {
      child = spawn(command, args, {
        stdio: 'inherit',
        detached: Boolean(signal) && process.platform !== 'win32',
        ...spawnOptions
      })
    } catch {
      finish(false)
      return
    }

    if (signal) {
      abortHandler = () => {
        if (child.exitCode !== null || child.signalCode !== null) return
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
            stdio: 'ignore',
            windowsHide: true
          })
          killer.once('error', () => child.kill('SIGTERM'))
          killer.once('exit', (code) => {
            if (code !== 0 && child.exitCode === null) child.kill('SIGTERM')
          })
        } else {
          try {
            process.kill(-child.pid, 'SIGTERM')
          } catch {
            child.kill('SIGTERM')
          }
        }
      }
      signal.addEventListener('abort', abortHandler, { once: true })
      if (signal.aborted) abortHandler()
    }

    child.once('error', () => finish(false))
    child.once('exit', (code) => finish(code === 0))
  })
}

function settleTask(task) {
  return task.then(
    () => ({ success: true }),
    (error) => ({ success: false, error })
  )
}

async function syncDatabase() {
  logStep('🗄️', '同步数据库...')
  if (!process.env.DATABASE_URL) {
    logWarning('未设置 DATABASE_URL，跳过数据库迁移')
    return
  }

  const nonInteractiveEnv = {
    ...process.env,
    DRIZZLE_KIT_FORCE: 'true',
    CI: 'true',
    NODE_ENV: 'production'
  }
  if (!(await execAsync(process.execPath, ['scripts/db-sync.js'], { env: nonInteractiveEnv }))) {
    throw new Error('数据库同步失败，已终止部署以避免运行时schema不一致')
  }
  logSuccess('数据库同步成功')

  if (fileExists('scripts/create-admin.js')) {
    logStep('👤', '检查管理员账户...')
    if (
      !(await execAsync('pnpm run create-admin', [], {
        env: nonInteractiveEnv,
        shell: true
      }))
    ) {
      throw new Error('创建或检查管理员账户失败')
    }
  }
}

async function buildApplication(signal) {
  if (process.env.SKIP_BUILD === 'true') {
    logStep('🔨', '跳过应用构建 (SKIP_BUILD=true)...')
    return
  }

  logStep('🔨', '构建应用...')
  if (!(await execAsync(process.execPath, ['scripts/build.js'], { env: process.env, signal }))) {
    throw new Error('应用构建失败')
  }
  logSuccess('应用构建完成')
}

// 检查环境变量
function checkEnvironment() {
  logStep('🔍', '检查环境配置...')

  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET']
  const missingVars = []

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName)
    }
  })

  if (missingVars.length > 0) {
    logError(`缺少必需的环境变量: ${missingVars.join(', ')}`)
    logError('请通过以下方式之一设置环境变量：')
    logError('1. 创建 .env 文件并配置 DATABASE_URL、JWT_SECRET')
    logError('2. 使用 docker run -e DATABASE_URL=xxx -e JWT_SECRET=xxx 传递环境变量')
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
      const reason = process.env.VERCEL ? 'Vercel 已完成依赖安装' : 'SKIP_INSTALL=true'
      logStep('📦', `跳过依赖安装 (${reason})...`)
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

    // 数据库操作主要等待网络，与 CPU 密集的 Nuxt 构建并行可缩短 serverless 部署时间。
    const buildController = new AbortController()
    const databaseTask = syncDatabase().catch((error) => {
      buildController.abort()
      throw error
    })

    // 数据库失败时主动取消构建；构建失败时等待迁移安全结束，避免中断数据库事务。
    const [databaseResult, buildResult] = await Promise.all([
      settleTask(databaseTask),
      settleTask(buildApplication(buildController.signal))
    ])
    if (!databaseResult.success) throw databaseResult.error
    if (!buildResult.success) throw buildResult.error

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
