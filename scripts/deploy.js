#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🚀 开始部署流程...');

try {
  // 1. 生成 Prisma 客户端
  console.log('📦 生成 Prisma 客户端...');
  execSync('prisma generate', { stdio: 'inherit' });

  // 2. 尝试数据库迁移，如果失败则使用 db push
  console.log('🗄️ 同步数据库结构...');
  try {
    execSync('prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ 数据库迁移成功');
  } catch (migrateError) {
    console.log('⚠️ 迁移失败，尝试使用 db push 同步数据库...');
    try {
      execSync('prisma db push', { stdio: 'inherit' });
      console.log('✅ 数据库同步成功');
    } catch (pushError) {
      console.error('❌ 数据库同步失败:', pushError.message);
      process.exit(1);
    }
  }

  // 3. 创建管理员账户（如果不存在）
  console.log('👤 检查管理员账户...');
  try {
    execSync('node scripts/create-admin.js', { stdio: 'inherit' });
    console.log('✅ 管理员账户检查完成');
  } catch (adminError) {
    console.log('⚠️ 管理员账户创建跳过（可能已存在）');
  }

  // 4. 构建应用
  console.log('🔨 构建应用...');
  execSync('nuxt build', { stdio: 'inherit' });
  console.log('✅ 应用构建完成');

  console.log('🎉 部署流程完成！');
} catch (error) {
  console.error('❌ 部署失败:', error.message);
  process.exit(1);
}
