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

    // 4. 数据库同步
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
        safeExec('pnpm run create-admin', { env })
      }
    } else {
      logWarning('未设置 DATABASE_URL')
    }

    // 5. 构建应用
    logStep('🔨', '构建应用...')
    if (!safeExec('node scripts/build.js', { env: process.env })) {
      throw new Error('构建失败')
    }
    logSuccess('构建完成')

    // 6. 验证构建输出
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
