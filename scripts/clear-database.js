/**
 * 数据库清空脚本
 * 这个脚本会清空所有表的数据，但保留表结构
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('开始清空数据库...')
  
  // 清空所有表数据
  try {
    // 按照关联关系顺序删除数据
    console.log('删除通知表数据...')
    await prisma.notification.deleteMany()
    console.log('通知表数据已删除')
    
    console.log('删除通知设置表数据...')
    await prisma.notificationSettings.deleteMany()
    console.log('通知设置表数据已删除')
    
    console.log('删除排期表数据...')
    await prisma.schedule.deleteMany()
    console.log('排期表数据已删除')
    
    console.log('删除投票表数据...')
    await prisma.vote.deleteMany()
    console.log('投票表数据已删除')
    
    console.log('删除歌曲表数据...')
    await prisma.song.deleteMany()
    console.log('歌曲表数据已删除')
    
    console.log('删除用户表数据...')
    await prisma.user.deleteMany()
    console.log('用户表数据已删除')
    
    console.log('数据库已清空，开始创建默认管理员账户...')
    
    // 创建默认管理员账户
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    // 创建管理员用户
    const admin = await prisma.user.create({
      data: {
        name: '管理员',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN'
      }
    })
    
    console.log('默认管理员账户已创建:')
    console.log('账号名: admin')
    console.log('密码: admin123')
    
    console.log('数据库清空和初始化完成!')
  } catch (error) {
    console.error('清空数据库时出错:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 