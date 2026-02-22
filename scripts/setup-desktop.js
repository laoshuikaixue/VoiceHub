#!/usr/bin/env node

/**
 * VoiceHub 桌面客户端设置脚本
 * 检查环境并提供设置指导
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkNodeVersion() {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0])
  
  log('\n📦 检查 Node.js 版本...', 'cyan')
  
  if (major >= 18) {
    log(`✅ Node.js ${version} (满足要求 >= 18.20.0)`, 'green')
    return true
  } else {
    log(`❌ Node.js ${version} (需要 >= 18.20.0)`, 'red')
    return false
  }
}

function checkDependencies() {
  log('\n📦 检查依赖安装...', 'cyan')
  
  const requiredDeps = [
    'electron',
    'electron-vite',
    'electron-builder',
    'electron-store'
  ]
  
  const packageJsonPath = join(process.cwd(), 'package.json')
  
  if (!existsSync(packageJsonPath)) {
    log('❌ 找不到 package.json', 'red')
    return false
  }
  
  try {
    const packageJson = JSON.parse(
      require('fs').readFileSync(packageJsonPath, 'utf-8')
    )
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.optionalDependencies
    }
    
    let allInstalled = true
    
    for (const dep of requiredDeps) {
      if (allDeps[dep]) {
        log(`✅ ${dep}`, 'green')
      } else {
        log(`❌ ${dep} (未安装)`, 'red')
        allInstalled = false
      }
    }
    
    return allInstalled
  } catch (error) {
    log(`❌ 读取 package.json 失败: ${error.message}`, 'red')
    return false
  }
}

function checkElectronFiles() {
  log('\n📁 检查 Electron 文件结构...', 'cyan')
  
  const requiredFiles = [
    'electron/main/index.ts',
    'electron/preload/index.ts',
    'electron-builder.config.ts',
    'electron.vite.config.ts',
    'nuxt.config.desktop.ts'
  ]
  
  let allExist = true
  
  for (const file of requiredFiles) {
    const filePath = join(process.cwd(), file)
    if (existsSync(filePath)) {
      log(`✅ ${file}`, 'green')
    } else {
      log(`❌ ${file} (不存在)`, 'red')
      allExist = false
    }
  }
  
  return allExist
}

function printNextSteps() {
  log('\n🚀 下一步操作:', 'blue')
  log('\n1. 安装依赖（如果还没安装）:', 'yellow')
  log('   npm install', 'cyan')
  
  log('\n2. 启动开发服务器:', 'yellow')
  log('   npm run dev:desktop', 'cyan')
  
  log('\n3. 构建桌面应用:', 'yellow')
  log('   npm run build:desktop', 'cyan')
  
  log('\n📚 更多信息请查看:', 'blue')
  log('   - README_DESKTOP.md (用户文档)', 'cyan')
  log('   - DESKTOP_DEVELOPMENT.md (开发指南)', 'cyan')
  log('')
}

function main() {
  log('═══════════════════════════════════════════', 'blue')
  log('  VoiceHub 桌面客户端环境检查', 'blue')
  log('═══════════════════════════════════════════', 'blue')
  
  const nodeOk = checkNodeVersion()
  const depsOk = checkDependencies()
  const filesOk = checkElectronFiles()
  
  log('\n═══════════════════════════════════════════', 'blue')
  
  if (nodeOk && depsOk && filesOk) {
    log('✅ 所有检查通过！环境已就绪', 'green')
  } else {
    log('⚠️  部分检查未通过，请解决上述问题', 'yellow')
    
    if (!nodeOk) {
      log('\n请升级 Node.js 到 18.20.0 或更高版本', 'yellow')
    }
    
    if (!depsOk) {
      log('\n请运行 npm install 安装依赖', 'yellow')
    }
    
    if (!filesOk) {
      log('\n请确保所有必需的 Electron 文件都已创建', 'yellow')
    }
  }
  
  printNextSteps()
}

main()
