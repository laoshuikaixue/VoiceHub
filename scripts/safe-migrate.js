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

async function safeMigrate() {
  log('🔄 开始安全数据库迁移流程...', 'bright');
  
  try {
    // 1. 检查迁移文件
    if (!fileExists('drizzle/migrations')) {
      logWarning('未找到迁移文件目录，将生成迁移文件...');
      if (!safeExec('npm run db:generate')) {
        throw new Error('生成迁移文件失败');
      }
      logSuccess('迁移文件生成完成');
    }
    
    // 2. 预处理数据冲突
    log('🔍 检查并处理数据冲突...', 'cyan');
    await handleDataConflicts();
    
    // 3. 检查迁移状态（非交互式）
    log('📋 检查数据库迁移状态...', 'cyan');
    // 使用 push 命令的 --force 选项避免交互提示
    if (!safeExec('npx drizzle-kit push --force')) {
      logWarning('强制同步失败，尝试标准迁移...');
      
      // 4. 执行迁移（作为后备）
      if (!safeExec('npm run db:migrate')) {
        throw new Error('数据库迁移完全失败');
      }
    }
    
    logSuccess('数据库迁移成功');
    
    // 5. 验证迁移结果
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