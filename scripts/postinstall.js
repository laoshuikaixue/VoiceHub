#!/usr/bin/env node

import { execSync } from 'child_process';

// 检查是否在CI环境中
const isCI = process.env.CI || process.env.NETLIFY || process.env.VERCEL;

if (isCI) {
  console.log('🔧 CI环境检测到，生成 Prisma 客户端...');
  
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma 客户端生成完成');
  } catch (error) {
    console.error('❌ Prisma 客户端生成失败:', error.message);
    // 在CI环境中不要因为Prisma生成失败而中断整个安装过程
    // 因为可能还没有设置DATABASE_URL
  }
} else {
  console.log('📝 本地开发环境，跳过自动生成 Prisma 客户端');
}