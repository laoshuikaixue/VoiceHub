#!/usr/bin/env node

import {config} from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';
import {db, notificationSettings, systemSettings, users} from '../drizzle/db.ts';
import bcrypt from 'bcrypt';
import {eq} from 'drizzle-orm';

// ES模块中获取当前目录 - 避免使用 __filename 和 __dirname 变量
const currentDir = path.dirname(fileURLToPath(import.meta.url));

// 加载环境变量
config({ path: path.resolve(currentDir, '../.env') });

// 检查环境变量
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 环境变量未设置');
  process.exit(1);
}

async function main() {
  try {
    // 检查是否已有超级管理员用户
    const existingSuperAdmin = await db.select()
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))
      .limit(1);

    if (existingSuperAdmin.length > 0) {
      console.log('✅ 超级管理员用户已存在，跳过创建');
      return existingSuperAdmin[0];
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 创建超级管理员用户
    const [admin] = await db.insert(users).values({
      username: 'admin',
      name: '超级管理员',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      forcePasswordChange: false
    }).returning();

    // 为管理员创建通知设置
    await db.insert(notificationSettings).values({
      userId: admin.id,
      enabled: true,
      songRequestEnabled: true,
      songVotedEnabled: true,
      songPlayedEnabled: true,
      refreshInterval: 60,
      songVotedThreshold: 1
    }).onConflictDoNothing();

    // 创建或更新系统设置
    await db.insert(systemSettings).values({
      id: 1,
      enablePlayTimeSelection: false
    }).onConflictDoNothing();

    console.log('✅ 管理员用户创建成功 (admin/admin123)');

    return admin;
  } catch (error) {
    console.error('创建管理员用户失败:', error);
    throw error;
  }
}

main()
  .catch(async (error) => {
    console.error('管理员初始化失败:', error.message);
    process.exit(1);
  });