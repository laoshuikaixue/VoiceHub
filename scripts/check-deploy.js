#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty'
});

async function checkDeployment() {
  console.log('🔍 检查部署状态...');
  
  try {
    // 检查数据库连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 检查表是否存在
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('📊 数据库表:', tables.map(t => t.table_name).join(', '));

    // 检查管理员用户
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });
    
    if (adminUser) {
      console.log('✅ 管理员用户存在');
    } else {
      console.log('⚠️ 管理员用户不存在');
    }

    // 检查系统设置
    const systemSettings = await prisma.systemSettings.findFirst();
    if (systemSettings) {
      console.log('✅ 系统设置已初始化');
    } else {
      console.log('⚠️ 系统设置未初始化');
    }

    // 检查迁移状态
    try {
      const migrations = await prisma.$queryRaw`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC 
        LIMIT 5
      `;
      console.log('📝 最近的迁移:', migrations.length);
    } catch (error) {
      console.log('⚠️ 无法查询迁移状态（可能使用了 db push）');
    }

    console.log('🎉 部署状态检查完成');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDeployment();
