import { prisma, checkDatabaseConnection, checkSchemaIntegrity, performDatabaseMaintenance, isFirstDeployment, initializeFirstDeployment } from '../models/schema'
import { PrismaClient } from '@prisma/client'

declare module 'h3' {
  interface H3EventContext {
    prisma: PrismaClient
  }
}

// 检查是否在Vercel环境中运行
const isVercelEnvironment = () => {
  return process.env.VERCEL === '1'
}

// 验证数据库表和字段是否符合预期
async function validateDatabase() {
  console.log('开始验证数据库结构...')
  try {
    // 检查必要的表是否存在，使用原始查询
    const tableQuery = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `
    
    const tables = tableQuery as { table_name: string }[]
    const tableNames = tables.map(t => t.table_name.toLowerCase())
    
    // 检查是否存在所有必要的表
    const requiredTables = ['user', 'song', 'vote', 'schedule', 'notification', 'notificationsettings', 'systemsettings', 'playtime']
    const missingTables = requiredTables.filter(table => !tableNames.includes(table))
    
    if (missingTables.length > 0) {
      console.warn(`数据库缺少以下表: ${missingTables.join(', ')}`)
      console.warn('需要运行数据库迁移')
      return false
    }
    
    // 检查Notification表的结构
    const notificationColumnsQuery = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'notification' OR table_name = 'Notification'
    `
    
    const notificationColumns = notificationColumnsQuery as { column_name: string, data_type: string }[]
    
    // 转换列名为小写进行不区分大小写的比较
    const columnNames = notificationColumns.map(c => c.column_name.toLowerCase())

    // 确保所有必要的字段都存在（使用小写比较）
    const requiredNotificationColumns = ['id', 'createdat', 'updatedat', 'type', 'message', 'read', 'userid', 'songid']
    const missingColumns = requiredNotificationColumns.filter(col => !columnNames.includes(col.toLowerCase()))
    
    if (missingColumns.length > 0) {
      console.warn(`Notification表缺少以下字段: ${missingColumns.join(', ')}`)
      console.warn('需要更新数据库结构')
      return false
    }
    
    // 验证用户表是否存在管理员用户
    const adminCount = await prisma.user.count({
      where: {
        role: 'ADMIN'
      }
    })
    
    if (adminCount === 0) {
      console.warn('数据库中没有管理员用户，可能需要初始化')
      return false
    }
    
    console.log('数据库结构验证成功')
    return true
  } catch (error) {
    console.error('验证数据库结构时出错:', error)
    return false
  }
}

export default defineNitroPlugin(async (nitroApp) => {
  try {
    // 记录当前环境
    const isVercelEnv = isVercelEnvironment()
    console.log(`应用正在${isVercelEnv ? 'Vercel' : '非Vercel'}环境中运行`)
    
    // 验证数据库连接
    const isConnected = await checkDatabaseConnection()
    if (!isConnected) {
      console.error('数据库连接失败，应用可能无法正常工作')
    } else {
      console.log('数据库连接成功，开始验证和初始化...')
      
      // 检查是否为首次部署
      const isFirstTime = await isFirstDeployment()
      
      if (isFirstTime) {
        console.log('检测到首次部署，将初始化数据库...')
        // 检查数据库架构完整性
        const schemaIntact = await checkSchemaIntegrity()
        
        if (!schemaIntact) {
          console.warn('数据库架构不完整，可能需要运行迁移')
          console.warn('在Vercel环境中，请确保已经手动运行了迁移，或使用外部数据库管理工具')
          
          // 在非Vercel环境下，可以考虑尝试自动迁移，但在这里我们只记录警告
        }
        
        // 初始化首次部署
        await initializeFirstDeployment()
      } else {
        console.log('检测到现有部署，将验证数据库结构...')
        
        // 在Vercel环境中，简化验证过程，避免过度消耗资源
        if (isVercelEnv) {
          console.log('在Vercel环境中，使用简化的数据库验证...')
          // 仅进行基本的表存在性检查
          try {
            // 尝试访问核心表
            await prisma.user.findFirst({ take: 1 })
            await prisma.song.findFirst({ take: 1 })
            console.log('数据库核心表检查通过')
          } catch (error) {
            console.error('数据库核心表检查失败:', error)
            console.warn('如果这是新部署，请确保已执行数据库迁移')
          }
        } else {
          // 非Vercel环境下进行完整验证
          const isValid = await validateDatabase()
          
          if (!isValid) {
            console.warn('数据库结构验证失败，将尝试修复...')
            // 执行数据库维护操作
            await performDatabaseMaintenance()
          }
        }
      }
    }
  } catch (error) {
    console.error('数据库初始化插件出错:', error)
  }
  
  // 将Prisma客户端附加到请求上下文
  nitroApp.hooks.hook('request', (event) => {
    event.context.prisma = prisma
  })
}) 