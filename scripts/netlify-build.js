#!/usr/bin/env node

import { spawn } from 'child_process'
import fs from 'fs'

// 颜色输出
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
  if (!process.env.DATABASE_URL) {
    logWarning('未设置 DATABASE_URL')
    return
  }

  logStep('🗄️', '同步数据库...')
  const env = { ...process.env, CI: 'true', DRIZZLE_KIT_FORCE: 'true', NODE_ENV: 'production' }
  if (!(await execAsync(process.execPath, ['scripts/db-sync.js'], { env }))) {
    throw new Error('数据库同步失败，已终止构建以避免运行时schema不一致')
  }
  logSuccess('数据库同步成功')

  if (fileExists('scripts/create-admin.js')) {
    logStep('👤', '检查管理员账户...')
    if (!(await execAsync('pnpm run create-admin', [], { env, shell: true }))) {
      throw new Error('创建或检查管理员账户失败')
    }
  }
}

async function buildApplication(signal) {
  logStep('🔨', '构建应用...')
  if (!(await execAsync(process.execPath, ['scripts/build.js'], { env: process.env, signal }))) {
    throw new Error('构建失败')
  }
  logSuccess('构建完成')
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

// Netlify 构建流程
async function netlifyBuild() {
  log('🚀 Netlify 构建', 'cyan')

  try {
    // 1. 设置环境变量
    process.env.NETLIFY = 'true'
    process.env.NITRO_PRESET = 'netlify'

    // Netlify 会在 build.command 前完成依赖安装，保留平台缓存可显著缩短后续部署。
    logStep('📦', '使用 Netlify 已安装的依赖和构建缓存...')

    // 2. 检查 Drizzle 配置
    if (!fileExists('drizzle.config.ts') || !fileExists('app/drizzle/schema.ts')) {
      throw new Error('Drizzle 配置文件不完整')
    }

    // 3. 确保迁移目录存在
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

    // 5. 验证构建输出
    const hasNetlifyFunctions = fileExists('.netlify/functions-internal/server')
    const hasOutputPublic = fileExists('.output/public')

    if (hasNetlifyFunctions) {
      logSuccess('Netlify Functions 生成成功')
    }

    if (hasOutputPublic) {
      logSuccess('静态资源生成成功')
    }

    if (!hasNetlifyFunctions && !hasOutputPublic) {
      throw new Error('构建输出目录不存在')
    }

    log('🎉 构建完成！', 'green')
  } catch (error) {
    logError(`构建失败: ${error.message}`)
    process.exit(1)
  }
}

// 运行构建
netlifyBuild().catch((error) => {
  logError(`未预期的错误: ${error.message}`)
  process.exit(1)
})
