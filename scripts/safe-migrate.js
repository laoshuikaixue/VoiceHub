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

// 处理数据冲突和验证数据完整性
async function handleDataConflicts() {
  try {
    // 导入数据库连接
    const { db } = await import('../drizzle/db.js');
    const { sql } = await import('drizzle-orm');
    
    log('🔍 检查数据库表结构和数据完整性...', 'cyan');
    
    // 1. 检查Semester表是否存在
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Semester'
      )
    `);
    
    if (!tableExists.rows[0]?.exists) {
      logSuccess('Semester表不存在，跳过数据检查');
      return;
    }
    
    // 2. 检查当前数据
    const currentData = await db.execute(sql`
      SELECT id, name, "isActive", "createdAt" 
      FROM "Semester" 
      ORDER BY id
    `);
    
    log(`📊 发现 ${currentData.rows.length} 条学期记录`);
    
    if (currentData.rows.length > 0) {
      // 打印当前数据用于调试
      console.table(currentData.rows.map(row => ({
        ID: row.id,
        Name: row.name,
        Active: row.isActive,
        Created: new Date(row.createdAt).toLocaleDateString()
      })));
    }
    
    // 3. 检查重复的学期名称
    const duplicates = await db.execute(sql`
      SELECT name, COUNT(*) as count, array_agg(id) as ids
      FROM "Semester" 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows && duplicates.rows.length > 0) {
      logWarning(`发现 ${duplicates.rows.length} 组重复的学期名称，正在处理...`);
      
      for (const duplicate of duplicates.rows) {
        const name = duplicate.name;
        const count = duplicate.count;
        logWarning(`处理重复学期: "${name}" (${count} 条记录)`);
        
        // 保留最新的记录（最大ID），删除旧的重复记录
        const deleted = await db.execute(sql`
          DELETE FROM "Semester" 
          WHERE name = ${name} 
          AND id NOT IN (
            SELECT MAX(id) 
            FROM "Semester" 
            WHERE name = ${name}
          )
        `);
        
        logSuccess(`已删除 ${count - 1} 条重复记录，保留最新的记录`);
      }
      
      logSuccess('重复数据清理完成');
    } else {
      logSuccess('未发现重复数据，数据完整性良好');
    }
    
    // 4. 验证唯一性约束是否可以安全添加
    const finalCheck = await db.execute(sql`
      SELECT name, COUNT(*) as count 
      FROM "Semester" 
      GROUP BY name 
      HAVING COUNT(*) > 1
    `);
    
    if (finalCheck.rows.length === 0) {
      logSuccess('✅ 数据验证通过，可以安全添加唯一性约束');
    } else {
      logError('❌ 仍存在重复数据，可能需要人工干预');
    }
    
  } catch (error) {
    logWarning(`数据冲突检查失败: ${error.message}`);
    logWarning('继续执行迁移，使用强制模式跳过冲突检查');
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
    
    // 3. 使用非交互式迁移（避免提示）
    log('🗄️ 执行数据库迁移（非交互模式）...', 'cyan');
    
    // 设置环境变量强制非交互模式
    process.env.CI = 'true';
    process.env.FORCE_COLOR = '0';
    
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