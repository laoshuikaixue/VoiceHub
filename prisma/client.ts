/**
 * 注意：此文件不再被直接使用，而是被server/models/schema.ts替代。
 * 保留此文件是为了向后兼容和可能的未来使用。
 * 
 * 如果需要修改Prisma客户端配置，请修改server/models/schema.ts文件。
 */

import { PrismaClient, Prisma } from '@prisma/client'

// PrismaClient 是附加到 `global` 对象的，以防止在开发过程中
// 热重载时创建多个实例
const globalForPrisma = global as unknown as { prisma: PrismaClient }

// 检查数据库连接字符串是否已设置
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set')
} else {
  // 打印数据库连接字符串的安全版本（隐藏敏感信息）
  try {
    const dbUrlObj = new URL(process.env.DATABASE_URL)
    console.log(`Database provider: ${dbUrlObj.protocol}`)
    console.log(`Database host: ${dbUrlObj.hostname}`)
    console.log(`Database port: ${dbUrlObj.port || 'default'}`)
    console.log(`Database name: ${dbUrlObj.pathname.replace('/', '')}`)
    console.log(`Database has password: ${dbUrlObj.password ? 'Yes' : 'No'}`)
    console.log(`Database connection string includes SSL parameters: ${dbUrlObj.search.includes('ssl') ? 'Yes' : 'No'}`)
  } catch (error) {
    console.error('Invalid DATABASE_URL format:', error)
  }
}

// 创建 Prisma 客户端实例，添加更多错误处理和重试逻辑
let prismaInstance: PrismaClient

// 最大重试次数
const MAX_RETRIES = 3;
// 初始重试延迟（毫秒）
const INITIAL_RETRY_DELAY = 1000;

// 创建带有重试机制的Prisma客户端
function createPrismaClient() {
  try {
    // 检查是否在Vercel环境中
    const isVercelEnv = process.env.VERCEL === '1';

    console.log(`Running in ${isVercelEnv ? 'Vercel' : 'standard'} environment`);

    // 在Vercel环境中使用更保守的日志设置
    const logLevels: Prisma.LogLevel[] = isVercelEnv
      ? ['error']
      : ['error', 'warn'];

    return new PrismaClient({
      log: logLevels,
      errorFormat: 'pretty',
      // 增强连接配置
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      // 添加连接池配置
      __internal: {
        engine: {
          connectTimeout: 60000, // 60秒连接超时
          queryTimeout: 60000,   // 60秒查询超时
        }
      }
    });
  } catch (error) {
    console.error('Failed to create Prisma client instance:', error);
    // 创建一个降级的 Prisma 客户端，只记录错误
    return new PrismaClient({
      log: ['error'],
      __internal: {
        engine: {
          connectTimeout: 30000,
          queryTimeout: 30000,
        }
      }
    });
  }
}

// 初始化Prisma客户端
if (process.env.NODE_ENV === 'production') {
  // 生产环境下总是创建新实例
  prismaInstance = createPrismaClient();
  console.log('Created new Prisma client instance in production mode');
} else {
  // 开发环境下复用全局实例
  prismaInstance = globalForPrisma.prisma || createPrismaClient();
  console.log('Using cached or new Prisma client instance in development mode');
}

// 导出 Prisma 客户端实例
export const prisma = prismaInstance;

// 连接数据库的函数，包含重试逻辑
async function connectWithRetry(retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) {
  try {
    await prisma.$connect();
    console.log('Successfully connected to the database');
    return true;
  } catch (error) {
    console.error(`Database connection attempt failed (${MAX_RETRIES - retries + 1}/${MAX_RETRIES}):`, error);
    
    // 解析错误类型并记录详细信息
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // 检查常见的连接错误
      if (error.message.includes('timeout')) {
        console.error('Connection timeout: Database server might be unreachable or blocked by firewall');
      } else if (error.message.includes('authentication')) {
        console.error('Authentication error: Check username and password in DATABASE_URL');
      } else if (error.message.includes('does not exist')) {
        console.error('Database does not exist: Check database name in DATABASE_URL');
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('Host not found: Check hostname in DATABASE_URL');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('Connection refused: Database server might be down or not accepting connections');
      }
    }
    
    // 如果还有重试次数，则等待后重试
    if (retries > 0) {
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // 指数退避策略，每次重试延迟时间翻倍
      return connectWithRetry(retries - 1, delay * 2);
    }
    
    console.error('All database connection attempts failed');
    return false;
  }
}

// 尝试连接数据库
connectWithRetry()
  .catch(error => {
    console.error('Database connection process failed completely:', error);
  });

// 只在非生产环境中缓存 Prisma 客户端实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
} else {
  console.log('Running in production mode, not caching Prisma client globally');
} 