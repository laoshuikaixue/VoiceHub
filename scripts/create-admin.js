import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  // 加密密码
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  // 创建管理员用户
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: '管理员',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });
  
  console.log('创建管理员用户成功:', admin);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('创建管理员用户失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 