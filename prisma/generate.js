#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 检查环境
const isNetlify = process.env.NETLIFY || process.env.NETLIFY_BUILD_BASE;
const isVercel = process.env.VERCEL;
const isCI = process.env.CI;

console.log('🔧 Prisma 客户端生成脚本启动...');
console.log(`环境检测: Netlify=${!!isNetlify}, Vercel=${!!isVercel}, CI=${!!isCI}`);

try {
  // 1. 清理之前的生成文件
  const clientPath = path.join(process.cwd(), 'node_modules', '@prisma', 'client');
  if (fs.existsSync(clientPath)) {
    console.log('🧹 清理之前的 Prisma 客户端...');
    fs.rmSync(clientPath, { recursive: true, force: true });
  }
  
  // 2. 设置环境变量
  if (isNetlify) {
    process.env.PRISMA_CLI_BINARY_TARGETS = 'debian-openssl-1.1.x,rhel-openssl-1.0.x';
    console.log('🔧 设置 Netlify 二进制目标');
  }
  
  // 3. 生成客户端
  console.log('🔧 生成 Prisma 客户端...');
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      // 确保在无数据库连接时也能生成客户端
      PRISMA_GENERATE_SKIP_AUTOINSTALL: 'false'
    }
  });
  
  // 4. 验证生成结果
  const generatedFiles = [
    'node_modules/@prisma/client/index.js',
    'node_modules/@prisma/client/default.js',
    'node_modules/@prisma/client/package.json'
  ];
  
  console.log('🔍 验证生成的文件...');
  for (const file of generatedFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ 缺少: ${file}`);
    }
  }
  
  console.log('✅ Prisma 客户端生成完成');
  
} catch (error) {
  console.error('❌ Prisma 客户端生成失败:', error.message);
  
  // 在CI环境中，如果是因为没有DATABASE_URL导致的失败，不要退出
  if (isCI && !process.env.DATABASE_URL) {
    console.log('⚠️ 检测到CI环境且无DATABASE_URL，继续构建过程...');
    process.exit(0);
  }
  
  process.exit(1);
}