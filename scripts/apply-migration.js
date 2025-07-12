// 手动执行迁移脚本
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  
  try {
    console.log('开始执行迁移...')
    
    // 检查sequence字段是否已存在
    try {
      // 尝试查询使用sequence字段
      await prisma.$queryRaw`SELECT "sequence" FROM "Schedule" LIMIT 1`
      console.log('sequence字段已存在，跳过迁移')
    } catch (error) {
      console.log('添加sequence字段到Schedule表...')
      
      // 执行添加字段的SQL
      await prisma.$executeRaw`ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "sequence" INTEGER NOT NULL DEFAULT 1`
      
      console.log('sequence字段添加成功')
    }
    
    console.log('迁移完成')
  } catch (error) {
    console.error('迁移失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => console.log('脚本执行完成'))
  .catch(e => {
    console.error('脚本执行失败:', e)
    process.exit(1)
  }) 