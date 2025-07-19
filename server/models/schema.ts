import { PrismaClient } from '@prisma/client'

// 为了避免循环引用，我们直接从@prisma/client导入PrismaClient
// 并在这里创建一个实例，而不是从prisma/client.ts导入
const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty'
})

// 添加数据库连接状态检查函数
export async function checkDatabaseConnection() {
  try {
    // 执行一个简单的查询来测试数据库连接
    const startTime = Date.now()
    console.log('Testing database connection...')
    
    // 设置超时，防止查询挂起
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection test timed out after 5000ms')), 5000)
    })
    
    // 实际的查询
    const queryPromise = prisma.$queryRaw`SELECT 1 as result`
    
    // 使用Promise.race来实现超时
    const result = await Promise.race([queryPromise, timeoutPromise])
    
    const duration = Date.now() - startTime
    console.log(`Database connection test successful in ${duration}ms:`, result)
    
    return true
  } catch (error) {
    // 详细记录错误信息
    if (error instanceof Error) {
      console.error('Database connection test failed:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      
      // 检查特定类型的错误
      if (error.message.includes('timeout')) {
        console.error('Connection test timed out - database server might be overloaded or network issues')
      } else if (error.message.includes('connect')) {
        console.error('Connection refused - check if database server is running and accessible')
      }
    } else {
      console.error('Database connection test failed with unknown error type:', error)
    }
    
    return false
  }
}

// 尝试重新连接数据库
export async function reconnectDatabase() {
  try {
    console.log('Attempting to disconnect from database...')
    await prisma.$disconnect()
    console.log('Disconnected from database')
    
    // 短暂延迟，确保完全断开连接
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('Attempting to reconnect to database...')
    const startTime = Date.now()
    
    // 设置连接超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database reconnection timed out after 10000ms')), 10000)
    })
    
    // 实际的连接尝试
    const connectPromise = prisma.$connect()
    
    // 使用Promise.race来实现超时
    await Promise.race([connectPromise, timeoutPromise])
    
    const duration = Date.now() - startTime
    console.log(`Reconnected to database in ${duration}ms`)
    
    // 验证连接是否真的成功
    const isConnected = await checkDatabaseConnection()
    if (!isConnected) {
      throw new Error('Reconnection appeared successful but connection test failed')
    }
    
    return true
  } catch (error) {
    // 详细记录错误信息
    if (error instanceof Error) {
      console.error('Failed to reconnect to database:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      
      // 检查特定类型的错误
      if (error.message.includes('timeout')) {
        console.error('Reconnection timed out - database server might be overloaded or network issues')
      } else if (error.message.includes('connect')) {
        console.error('Reconnection refused - check if database server is running and accessible')
      }
    } else {
      console.error('Failed to reconnect to database with unknown error type:', error)
    }
    
    return false
  }
}
 
// 检查数据库模式是否需要迁移
export async function checkSchemaIntegrity() {
  try {
    console.log('检查数据库架构完整性...')
    
    // 尝试访问数据库中的所有必要表
    // 如果任何一个表不存在，查询将失败
    const testQueries = [
      prisma.user.count(),
      prisma.song.count(),
      prisma.vote.count(),
      prisma.schedule.count(),
      prisma.notification.count(),
      prisma.notificationSettings.count(),
      prisma.systemSettings.count(),
      prisma.playTime.count()
    ]
    
    await Promise.all(testQueries)
    
    console.log('数据库架构检查通过')
    return true
  } catch (error) {
    console.error('数据库架构检查失败:', error)
    
    // 判断是否是因为表不存在导致的错误
    if (error instanceof Error && 
        (error.message.includes('relation') || 
         error.message.includes('table') || 
         error.message.includes('does not exist'))) {
      console.error('数据库可能需要迁移，表结构不完整')
      return false
    }
    
    return false
  }
}

// 安全地执行数据库修复操作
export async function performDatabaseMaintenance() {
  try {
    console.log('执行数据库维护操作...')
    
    // 添加重试次数限制，防止无限循环
    let retryCount = 0;
    const maxRetries = 2;
    let success = false;
    
    // 首先验证notification表是否存在及其结构
    try {
      console.log('检查Notification表结构...')
      // 使用原始查询检查表结构，不使用Prisma模型直接访问
      const columnQuery = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'notification' OR table_name = 'Notification'
      `;
      
      const columns = columnQuery as { column_name: string }[];
      const columnNames = columns.map(c => c.column_name.toLowerCase());
      
      console.log('发现的Notification表字段:', columnNames.join(', '));
      
      // 检查必要字段是否存在
      const requiredColumns = ['id', 'createdat', 'updatedat', 'type', 'message', 'read', 'userid', 'songid'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col.toLowerCase()));
      
      if (missingColumns.length > 0) {
        console.warn(`Notification表缺少字段: ${missingColumns.join(', ')}`);
        console.warn('此问题需要手动修复，请执行数据库迁移');
      } else {
        console.log('Notification表结构检查通过');
        success = true;
      }
    } catch (err) {
      console.error('检查Notification表结构失败:', err);
      console.warn('无法验证表结构，可能需要手动修复');
    }
    
    // 不再尝试直接查询notification模型，避免无限循环
    
    // 检查并修复缺少通知设置的用户
    try {
      console.log('检查用户通知设置...')
      const usersWithoutSettings = await prisma.user.findMany({
        where: {
          notificationSettings: null
        },
        select: {
          id: true
        }
      })
      
      if (usersWithoutSettings.length > 0) {
        console.log(`发现${usersWithoutSettings.length}个用户缺少通知设置，正在修复...`)
        
        for (const user of usersWithoutSettings) {
          await prisma.notificationSettings.create({
            data: {
              userId: user.id,
              enabled: true,
              songRequestEnabled: true,
              songVotedEnabled: true,
              songPlayedEnabled: true,
              refreshInterval: 60,
              songVotedThreshold: 1
            }
          })
        }
        
        console.log('已修复所有用户的通知设置')
      } else {
        console.log('所有用户都有通知设置')
      }
      
      success = true;
    } catch (err) {
      console.error('修复用户通知设置失败:', err);
    }
    
    // 检查并创建系统设置
    try {
      console.log('检查系统设置...')
      const systemSettings = await prisma.systemSettings.findFirst();
      
      if (!systemSettings) {
        console.log('未找到系统设置，正在创建默认设置...')
        
        await prisma.systemSettings.create({
          data: {
            enablePlayTimeSelection: false
          }
        });
        
        console.log('已创建默认系统设置')
      } else {
        console.log('系统设置已存在')
      }
      
      success = true;
    } catch (err) {
      console.error('检查/创建系统设置失败:', err);
    }
    
    if (success) {
      console.log('数据库维护操作完成');
      return true;
    } else {
      console.warn('数据库维护操作部分完成，仍有问题未解决');
      console.warn('建议执行 npm run repair-db 进行更彻底的修复');
      return false;
    }
  } catch (error) {
    console.error('数据库维护操作失败:', error)
    return false
  }
}

// 检测是否为首次部署
export async function isFirstDeployment() {
  try {
    // 检查用户表是否为空
    const userCount = await prisma.user.count()
    return userCount === 0
  } catch (error) {
    // 如果查询失败，可能是因为表不存在，这也视为首次部署
    console.log('检测首次部署时出错，假定为首次部署:', error)
    return true
  }
}

// 创建一个初始管理员用户和基本设置
export async function initializeFirstDeployment() {
  try {
    console.log('初始化首次部署...')
    
    // 检查是否真的需要初始化
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      console.log('数据库已有用户，跳过初始化')
      return true
    }

    const bcrypt = await import('bcrypt')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    // 创建管理员用户
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        name: '管理员',
        password: hashedPassword,
        role: 'ADMIN'
      }
    })
    
    // 为管理员创建通知设置
    await prisma.notificationSettings.create({
      data: {
        userId: admin.id,
        enabled: true,
        songRequestEnabled: true,
        songVotedEnabled: true,
        songPlayedEnabled: true,
        refreshInterval: 60,
        songVotedThreshold: 1
      }
    })
    
    // 创建系统设置
    await prisma.systemSettings.create({
      data: {
        enablePlayTimeSelection: false
      }
    })
    
    console.log('初始化完成，已创建管理员账户 (用户名: admin, 密码: admin123)')
    return true
  } catch (error) {
    console.error('初始化首次部署失败:', error)
    return false
  }
}
 
// 数据库模型在prisma/schema.prisma中定义 
export { prisma } 