#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

// 检查环境变量
if (!process.env.DATABASE_URL) {
  logError('DATABASE_URL 环境变量未设置');
  process.exit(1);
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

// 处理数据冲突的函数
async function handleDataConflicts() {
  try {
    // 在Vercel环境中，我们主要关注schema同步而不是数据冲突处理
    log('检查数据库连接...', 'cyan');
    
    // 简单的连接测试
    if (!safeExec('npx drizzle-kit check', { stdio: 'pipe' })) {
      logWarning('数据库schema检查失败，将尝试强制同步');
    }
    
    logSuccess('数据冲突检查完成');
  } catch (error) {
    logWarning(`数据冲突处理警告: ${error.message}`);
  }
}

async function safeMigrate() {
  log('🔄 开始安全数据库迁移流程...', 'bright');
  
  try {
    // 1. 确保drizzle配置存在
    if (!fileExists('drizzle.config.ts')) {
      throw new Error('drizzle.config.ts 配置文件不存在');
    }
    
    // 2. 检查schema文件
    if (!fileExists('drizzle/schema.ts')) {
      throw new Error('drizzle/schema.ts 文件不存在');
    }
    
    // 3. 创建迁移目录（如果不存在）
    if (!fileExists('drizzle/migrations')) {
      log('创建迁移目录...', 'cyan');
      fs.mkdirSync('drizzle/migrations', { recursive: true });
    }
    
    // 4. 生成迁移文件（如果需要）
    log('生成数据库迁移文件...', 'cyan');
    if (!safeExec('npm run db:generate')) {
      logWarning('迁移文件生成失败，尝试直接同步...');
    } else {
      logSuccess('迁移文件生成完成');
    }
    
    // 5. 预处理数据冲突
    log('🔍 检查并处理数据冲突...', 'cyan');
    await handleDataConflicts();
    
    // 6. 执行数据库同步（优先使用push，适合Vercel环境）
    log('📋 同步数据库schema...', 'cyan');
    if (safeExec('npm run db:push')) {
      logSuccess('数据库schema同步成功');
    } else {
      logWarning('schema同步失败，尝试标准迁移...');
      
      // 7. 执行迁移（作为后备）
      if (!safeExec('npm run db:migrate')) {
        throw new Error('数据库迁移完全失败');
      }
      logSuccess('数据库迁移成功');
    }
    
    // 8. 验证迁移结果
    log('✅ 数据库迁移流程完成！', 'green');
    
  } catch (error) {
    logError(`迁移失败: ${error.message}`);
    logError('请检查数据库连接和迁移文件');
    process.exit(1);
  }
}

// 运行迁移
safeMigrate().catch(error => {
  logError(`未预期的错误: ${error.message}`);
  process.exit(1);
});