#!/usr/bin/env node

import {execSync} from 'child_process';
import fs from 'fs';
import {config} from 'dotenv';

// 加载环境变量
config();

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

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// 安全执行命令
function safeExec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
}

// 检查环境变量
function checkEnvironment() {
  logStep('🔍', '检查环境配置...');
  
  const requiredEnvVars = ['DATABASE_URL'];
  const missingVars = [];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    logWarning(`缺少环境变量: ${missingVars.join(', ')}`);
    logWarning('请确保在部署平台设置了正确的环境变量');
  } else {
    logSuccess('环境变量检查通过');
  }
  
  return missingVars.length === 0;
}

// 主部署流程
async function deploy() {
  log('🚀 开始部署流程...', 'bright');
  
  try {
    // 0. 检查环境
    checkEnvironment();
    
    // 1. 安装依赖
    logStep('📦', '检查并安装依赖...');
    if (!safeExec('npm install')) {
      throw new Error('依赖安装失败');
    }
    logSuccess('依赖安装完成');

    // 2. 检查 Drizzle 配置
    logStep('🔧', '检查 Drizzle 配置...');
    if (!fileExists('drizzle.config.ts')) {
      throw new Error('Drizzle 配置文件不存在');
    }
    if (!fileExists('app/drizzle/schema.ts')) {
      throw new Error('Drizzle schema 文件不存在');
    }
    if (!fileExists('app/drizzle/db.ts')) {
      throw new Error('Drizzle 数据库连接文件不存在');
    }
    logSuccess('Drizzle 配置检查完成');

    // 2.1. 确保迁移目录存在
    if (!fileExists('app/drizzle/migrations')) {
      logStep('📁', '创建迁移目录...');
      fs.mkdirSync('app/drizzle/migrations', { recursive: true });
      logSuccess('迁移目录创建完成');
    }

    // 3. 数据库同步
    logStep('🗄️', '执行数据库同步...');
    let dbSyncSuccess = false;
    if (process.env.DATABASE_URL) {
      const nonInteractiveEnv = {
        ...process.env,
        DRIZZLE_KIT_FORCE: 'true',
        CI: 'true',
        NODE_ENV: 'production'
      };
      if (safeExec('node scripts/db-sync.js', { env: nonInteractiveEnv })) {
        logSuccess('数据库同步成功');
        dbSyncSuccess = true;
      } else {
        logWarning('数据库同步失败，继续构建...');
      }
    } else {
      logWarning('未设置 DATABASE_URL，跳过数据库迁移');
      logWarning('请确保在部署平台设置了正确的数据库连接字符串');
    }

    // 4. 创建管理员账户（如果脚本存在）
    if (fileExists('scripts/create-admin.js')) {
      logStep('👤', '检查管理员账户...');
      if (safeExec('npm run create-admin')) {
        logSuccess('管理员账户检查完成');
      } else {
        logWarning('管理员账户创建跳过（可能已存在或数据库未连接）');
      }
    }

    // 5. 构建应用
    logStep('🔨', '构建应用...');
    if (!safeExec('npx nuxt build')) {
      throw new Error('应用构建失败');
    }
    logSuccess('应用构建完成');

    // 6. 部署后检查
    logStep('🔍', '执行部署后检查...');
    if (fileExists('scripts/check-deploy.js')) {
      safeExec('node scripts/check-deploy.js');
    }
    
    log('🎉 部署流程完成！', 'green');
    
    if (!dbSyncSuccess) {
      logWarning('注意：数据库同步可能未完全成功，请检查数据库连接');
    }
    
  } catch (error) {
    logError(`部署失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行部署
deploy().catch(error => {
  logError(`未预期的错误: ${error.message}`);
  process.exit(1);
});