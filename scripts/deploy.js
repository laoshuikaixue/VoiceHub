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

// 测试数据库连接
async function testDatabaseConnection() {
  logStep('🔗', '测试数据库连接...');
  
  try {
    // 使用 Prisma 测试连接
    const testCommand = 'npx prisma db execute --stdin';
    const testQuery = 'SELECT 1 as test;';
    
    const result = safeExec(`echo "${testQuery}" | ${testCommand}`, { 
      stdio: 'pipe',
      timeout: 30000 // 30秒超时
    });
    
    if (result) {
      logSuccess('数据库连接测试成功');
      return true;
    } else {
      logWarning('数据库连接测试失败，但继续部署流程');
      return false;
    }
  } catch (error) {
    logWarning(`数据库连接测试异常: ${error.message}`);
    logWarning('继续部署流程，但可能存在连接问题');
    return false;
  }
}

// 验证 Prisma 配置
function validatePrismaConfig() {
  logStep('⚙️', '验证 Prisma 配置...');
  
  const schemaPath = 'prisma/schema.prisma';
  if (!fileExists(schemaPath)) {
    logError('未找到 Prisma schema 文件');
    return false;
  }
  
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // 检查是否包含必要的二进制目标
    const requiredTargets = ['rhel-openssl-3.0.x', 'debian-openssl-1.1.x'];
    const hasBinaryTargets = requiredTargets.some(target => 
      schemaContent.includes(target)
    );
    
    if (hasBinaryTargets) {
      logSuccess('Prisma 配置验证通过');
      return true;
    } else {
      logWarning('Prisma schema 可能缺少云部署所需的二进制目标');
      return false;
    }
  } catch (error) {
    logError(`Prisma 配置验证失败: ${error.message}`);
    return false;
  }
}

// 主部署流程
async function deploy() {
  log('🚀 开始部署流程...', 'bright');
  
  try {
    // 0. 检查环境
    checkEnvironment();
    
    // 0.1. 验证 Prisma 配置
    validatePrismaConfig();
    
    // 1. 安装依赖（如果需要）
    if (!fileExists('node_modules')) {
      logStep('📦', '安装依赖...');
      if (!safeExec('npm ci')) {
        throw new Error('依赖安装失败');
      }
      logSuccess('依赖安装完成');
    }
    
    // 2. 生成 Prisma 客户端
    logStep('🔧', '生成 Prisma 客户端...');
    if (!safeExec('npx prisma generate')) {
      throw new Error('Prisma 客户端生成失败');
    }
    logSuccess('Prisma 客户端生成完成');
    
    // 3. 测试数据库连接
    const dbConnected = await testDatabaseConnection();
    
    // 4. 数据库迁移
    logStep('🗄️', '同步数据库结构...');
    let dbSyncSuccess = false;
    
    if (dbConnected) {
      // 首先尝试 migrate deploy
      if (safeExec('npx prisma migrate deploy')) {
        logSuccess('数据库迁移成功');
        dbSyncSuccess = true;
      } else {
        logWarning('迁移失败，尝试使用 db push 同步数据库...');
        
        // 如果迁移失败，尝试 db push
        if (safeExec('npx prisma db push --accept-data-loss')) {
          logSuccess('数据库同步成功');
          dbSyncSuccess = true;
        } else {
          logError('数据库同步失败');
          // 不直接退出，继续尝试构建
        }
      }
    } else {
      logWarning('跳过数据库迁移（连接测试失败）');
    }
    
    // 5. 创建管理员账户（如果脚本存在且数据库连接正常）
    if (fileExists('scripts/create-admin.js') && dbSyncSuccess) {
      logStep('👤', '检查管理员账户...');
      if (safeExec('node scripts/create-admin.js')) {
        logSuccess('管理员账户检查完成');
      } else {
        logWarning('管理员账户创建跳过（可能已存在或数据库未连接）');
      }
    }
    
    // 6. 构建应用
    logStep('🔨', '构建应用...');
    if (!safeExec('npx nuxt build')) {
      throw new Error('应用构建失败');
    }
    logSuccess('应用构建完成');
    
    // 7. 部署后检查
    logStep('🔍', '执行部署后检查...');
    if (fileExists('scripts/check-deploy.js')) {
      safeExec('node scripts/check-deploy.js');
    }
    
    // 8. 最终数据库连接验证
    if (dbSyncSuccess) {
      await testDatabaseConnection();
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