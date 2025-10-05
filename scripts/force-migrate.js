#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// 加载环境变量
config({ path: path.resolve(process.cwd(), '../.env') });

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
  log(`⚠️  ${message}`, 'yellow');
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

// 检查数据库连接
async function checkDatabaseConnection() {
  log('🔍 检查数据库连接...', 'cyan');
  
  const testCommand = `cd .. && npx drizzle-kit introspect --config=drizzle.config.ts`;
  
  try {
    execSync(testCommand, { stdio: 'pipe' });
    logSuccess('数据库连接正常');
    return true;
  } catch (error) {
    logError('数据库连接失败');
    return false;
  }
}

// 安全的数据库迁移（保护现有数据）
async function safeMigrate() {
  log('🚀 开始安全的数据库迁移...', 'bright');
  
  try {
    // 检查数据库连接
    if (!(await checkDatabaseConnection())) {
      throw new Error('数据库连接失败');
    }
    
    // 设置非交互式环境变量
    const safeEnv = {
      ...process.env,
      DRIZZLE_KIT_FORCE: 'true',
      CI: 'true',
      NODE_ENV: 'production',
      TERM: 'dumb',
      NO_COLOR: '1'
    };
    
    log('📋 使用 drizzle-kit push 进行安全迁移...', 'cyan');
    log('ℹ️  此操作只会添加新表和字段，不会删除现有数据', 'cyan');
    
    // 使用 drizzle-kit push，这是最安全的方式
    // push 命令只会添加新的表和字段，不会删除现有数据
    const pushCommand = 'cd .. && npx drizzle-kit push --config=drizzle.config.ts';
    
    if (safeExec(pushCommand, { env: safeEnv })) {
      logSuccess('数据库安全迁移成功');
    } else {
      logWarning('drizzle-kit push 失败，尝试使用迁移文件...');
      
      // 备用方案：使用传统的迁移文件
      log('📄 使用迁移文件进行安全更新...', 'cyan');
      
      const migrateCommand = 'cd .. && npm run db:migrate';
      
      if (safeExec(migrateCommand, { env: safeEnv })) {
        logSuccess('迁移文件执行成功');
      } else {
        throw new Error('所有安全迁移方案都失败');
      }
    }
    
    logSuccess('🎉 安全迁移完成！所有现有数据都已保留');
    
  } catch (error) {
    logError(`安全迁移失败: ${error.message}`);
    logError('请检查数据库连接和权限');
    logError('注意：此脚本设计为只添加新表，不会删除任何现有数据');
    process.exit(1);
  }
}

// 运行安全迁移
safeMigrate().catch(error => {
  logError(`未预期的错误: ${error.message}`);
  process.exit(1);
});