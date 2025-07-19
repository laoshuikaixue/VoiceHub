import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查环境变量
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 环境变量未设置');
  process.exit(1);
}

const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty'
});

async function main() {
  try {
    await prisma.$connect();

    // 检查是否已有管理员用户
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('✅ 管理员用户已存在，跳过创建');
      return existingAdmin;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 创建管理员用户
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        name: '管理员',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });

    // 为管理员创建通知设置
    await prisma.notificationSettings.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        enabled: true,
        songRequestEnabled: true,
        songVotedEnabled: true,
        songPlayedEnabled: true,
        refreshInterval: 60,
        songVotedThreshold: 1
      }
    });

    // 创建或更新系统设置
    await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        enablePlayTimeSelection: false
      }
    });

    console.log('✅ 管理员用户创建成功 (admin/admin123)');

    return admin;
  } catch (error) {
    console.error('创建管理员用户失败:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('管理员初始化失败:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  });