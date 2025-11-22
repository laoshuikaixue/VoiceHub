#!/usr/bin/env node

import {execSync} from 'child_process';
import fs from 'fs';

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`${step} ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// 安全执行命令
function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    logError(`命令执行失败: ${command}`);
    logError(error.message);
    return false;
  }
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// Netlify 构建流程
async function netlifyBuild() {
  log('🚀 开始 Netlify 构建流程...', 'bright');
  
  try {
    // 1. 设置环境变量
    process.env.NETLIFY = 'true';
    process.env.NITRO_PRESET = 'netlify';
    
    logStep('🔧', '设置 Netlify 环境变量...');
    logSuccess('环境变量设置完成');
    
    // 2. 清理之前的构建
    logStep('🧹', '清理之前的构建...');
    if (fileExists('dist')) {
      safeExec('rm -rf dist');
    }
    if (fileExists('.netlify')) {
      safeExec('rm -rf .netlify');
    }
    if (fileExists('.nuxt')) {
      safeExec('rm -rf .nuxt');
    }
    logSuccess('清理完成');
    
    // 3. 安装依赖
    logStep('📦', '安装依赖...');
    // 在CI环境中总是重新安装依赖
    if (fileExists('node_modules')) {
      logStep('🧹', '清理现有依赖...');
      safeExec('rm -rf node_modules');
    }
    
    if (!safeExec('npm ci')) {
      throw new Error('依赖安装失败');
    }
    
    // 确保 Drizzle 相关依赖正确安装
    logStep('🔍', '验证 Drizzle 依赖...');
    if (!safeExec('npm list drizzle-orm drizzle-kit')) {
      logStep('📦', '重新安装 Drizzle 依赖...');
      if (!safeExec('npm install drizzle-orm drizzle-kit')) {
        throw new Error('Drizzle 依赖安装失败');
      }
    }
    logSuccess('依赖安装完成');
    
    // 4. 检查 Drizzle 配置（关键步骤）
    logStep('🔧', '检查 Drizzle 配置...');
    
    // 检查 Drizzle 配置文件
    if (!fileExists('drizzle.config.ts')) {
      throw new Error('Drizzle 配置文件不存在');
    }
    
    if (!fileExists('drizzle/schema.ts')) {
      throw new Error('Drizzle schema 文件不存在');
    }
    
    logSuccess('Drizzle 配置检查完成');
    
    // 5. 验证 Drizzle 配置是否正确
    logStep('🔍', '验证 Drizzle 配置...');
    const drizzleConfigPath = 'drizzle.config.ts';
    const drizzleSchemaPath = 'drizzle/schema.ts';
    
    if (!fileExists(drizzleConfigPath)) {
      throw new Error('Drizzle 配置文件未找到');
    }
    
    if (!fileExists(drizzleSchemaPath)) {
      throw new Error('Drizzle schema 文件未找到');
    }
    
    logSuccess('Drizzle 配置验证成功');
    
    // 6. 数据库同步
    if (process.env.DATABASE_URL) {
      logStep('🗄️', '执行数据库同步...')
      const env = { ...process.env, CI: 'true', DRIZZLE_KIT_FORCE: 'true', NODE_ENV: 'production' }
      if (safeExec('node scripts/db-sync.js', { env })) {
        logSuccess('数据库同步成功')
      } else {
        logWarning('数据库同步失败，继续构建...')
      }
    } else {
      logWarning('未设置 DATABASE_URL，跳过数据库迁移')
    }
    
    // 7. 构建应用
    logStep('🔨', '构建 Nuxt 应用...');
    if (!safeExec('npx nuxt build')) {
      throw new Error('Nuxt 应用构建失败');
    }
    logSuccess('Nuxt 应用构建完成');
    
    // 8. 验证构建输出
    logStep('🔍', '验证构建输出...');
    if (!fileExists('.output')) {
      throw new Error('构建输出目录不存在');
    }
    
    if (!fileExists('.output/server/index.mjs')) {
      logWarning('服务器入口文件不存在，检查构建配置');
    } else {
      logSuccess('服务器入口文件生成成功');
    }
    
    log('🎉 Netlify 构建完成！', 'green');
    
  } catch (error) {
    logError(`构建失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行构建
netlifyBuild().catch(error => {
  logError(`未预期的错误: ${error.message}`);
  process.exit(1);
});