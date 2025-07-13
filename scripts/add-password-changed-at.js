// 添加passwordChangedAt字段到User表
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  
  try {
    console.log('开始执行迁移: 添加passwordChangedAt字段...')
    
    // 检查passwordChangedAt字段是否已存在
    try {
      // 尝试查询使用passwordChangedAt字段
      await prisma.$queryRaw`SELECT "passwordChangedAt" FROM "User" LIMIT 1`
      console.log('passwordChangedAt字段已存在，跳过迁移')
    } catch (error) {
      console.log('添加passwordChangedAt字段到User表...')
      
      // 执行添加字段的SQL
      await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3)`
      
      console.log('passwordChangedAt字段添加成功')
    }
    
    console.log('迁移完成')
  } catch (error) {
    console.error('迁移失败:', error)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => console.log('脚本执行完成'))
  .catch(e => {
    console.error('脚本执行失败:', e)
    console.error(e.stack)
    process.exit(1)
  }) 