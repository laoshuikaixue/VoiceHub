#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'

// 颜色输出
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

// Netlify 构建流程
async function netlifyBuild() {
  log('🚀 Netlify 构建', 'cyan')

  try {
    // 1. 设置环境变量
    process.env.NETLIFY = 'true'
    process.env.NITRO_PRESET = 'netlify'

    // 2. 清理构建目录
    logStep('🧹', '清理构建目录...')
    if (fileExists('dist')) safeExec('rm -rf dist')
    if (fileExists('.netlify')) safeExec('rm -rf .netlify')
    if (fileExists('.nuxt')) safeExec('rm -rf .nuxt')
    logSuccess('清理完成')

    // 3. 安装依赖
    logStep('📦', '安装依赖...')
    let installed = false
    if (fileExists('node_modules')) {
      safeExec('rm -rf node_modules')
    }

    if (fileExists('package-lock.json')) {
      if (safeExec('npm ci')) {
        installed = true
        logSuccess('依赖安装完成 (npm ci)')
      } else {
        logWarning('npm ci 安装失败，准备回退到 npm install...')
      }
    } else {
      logWarning('未检测到 package-lock.json，跳过 npm ci，直接使用 npm install...')
    }

    if (!installed) {
      if (!safeExec('npm install')) {
        throw new Error('依赖安装失败')
      }
      logSuccess('依赖安装完成 (npm install)')
    }

    // 验证 Drizzle 依赖
    if (!safeExec('npm list drizzle-orm drizzle-kit')) {
      if (!safeExec('npm install drizzle-orm drizzle-kit')) {
        throw new Error('Drizzle 依赖安装失败')
      }
    }
    // 4. 检查 Drizzle 配置
    if (!fileExists('drizzle.config.ts') || !fileExists('app/drizzle/schema.ts')) {
      throw new Error('Drizzle 配置文件不完整')
    }

    // 5. 确保迁移目录存在
    if (!fileExists('app/drizzle/migrations')) {
      fs.mkdirSync('app/drizzle/migrations', { recursive: true })
    }

    // 6. 数据库同步
    if (process.env.DATABASE_URL) {
      logStep('�️', '同步数据库...')
      const env = { ...process.env, CI: 'true', DRIZZLE_KIT_FORCE: 'true', NODE_ENV: 'production' }
      if (safeExec('node scripts/db-sync.js', { env })) {
        logSuccess('数据库同步成功')
      } else {
        logWarning('数据库同步失败')
      }

      // 检查管理员账户
      if (fileExists('scripts/create-admin.js')) {
        logStep('👤', '检查管理员账户...')
        safeExec('npm run create-admin', { env })
      }
    } else {
      logWarning('未设置 DATABASE_URL')
    }

    // 7. 构建应用
    logStep('🔨', '构建应用...')
    const buildEnv = {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || DEFAULT_NODE_OPTIONS
    }
    if (!safeExec('npx nuxt build', { env: buildEnv })) {
      throw new Error('构建失败')
    }
    logSuccess('构建完成')

    // 8. 验证构建输出
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
