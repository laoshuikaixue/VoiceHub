/**
 * 通知设置初始化脚本
 * 为所有没有通知设置的用户创建默认通知设置
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('开始初始化通知设置...')
    
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        notificationSettings: true
      }
    })
    
    console.log(`找到 ${users.length} 个用户`)
    
    // 计数器
    let created = 0
    let skipped = 0
    
    // 为每个没有通知设置的用户创建默认设置
    for (const user of users) {
      if (!user.notificationSettings) {
        await prisma.notificationSettings.create({
          data: {
            userId: user.id,
            songSelectedNotify: true,
            songPlayedNotify: true,
            songVotedNotify: true,
            systemNotify: true
          }
        })
        console.log(`为用户 ${user.username} (ID: ${user.id}) 创建了默认通知设置`)
        created++
      } else {
        console.log(`用户 ${user.username} (ID: ${user.id}) 已有通知设置，跳过`)
        skipped++
      }
    }
    
    console.log('通知设置初始化完成!')
    console.log(`创建了 ${created} 个通知设置，跳过了 ${skipped} 个已有设置`)
  } catch (error) {
    console.error('初始化通知设置时出错:', error)
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