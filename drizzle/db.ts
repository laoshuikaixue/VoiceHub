import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, gte, lt, count, exists, desc, asc, or } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.ts';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载环境变量
const currentDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDir, '../.env') });

// 检查环境变量
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 创建PostgreSQL连接
const connectionString = process.env.DATABASE_URL;

// Neon Database 优化配置 - Serverless 架构
const client = postgres(connectionString, {
  // Neon Database 连接池优化
  max: process.env.NODE_ENV === 'production' ? 3 : 5, // Neon 推荐较少连接数
  idle_timeout: 10, // 快速释放空闲连接，支持自动启停
  connect_timeout: 10, // Neon 连接速度快，减少超时时间
  max_lifetime: 3600, // 连接最大生命周期（1小时）
  
  // SSL 配置 - Neon 默认需要 SSL
  ssl: 'require',
  
  // 性能优化
  prepare: false, // 禁用预处理语句以提高兼容性
  transform: {
    undefined: null, // 将undefined转换为null
  },
  
  // 连接标识和调试
  connection: {
    application_name: 'voicehub-app'
  },
  
  // Neon Database 特定优化
  onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
  debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
});

// 创建Drizzle数据库实例
export const db = drizzle(client, { schema });

// 导出连接客户端（用于手动查询或关闭连接）
export { client };

// 导出schema以便在其他地方使用
export * from './schema.ts';

// 导出drizzle-orm函数
export { eq, and, gte, lt, count, exists, desc, asc, or };

// 数据库连接测试函数
export async function testConnection() {
  try {
    await client`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// 获取数据库连接状态
export function getConnectionStatus() {
  return {
    isConnected: !client.ended,
    maxConnections: client.options.max,
    idleTimeout: client.options.idle_timeout,
    connectTimeout: client.options.connect_timeout
  };
}

// 自动启停管理 - 适配 Neon Database Serverless
let idleTimer: NodeJS.Timeout | null = null;
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5分钟空闲后自动断开

// 重置空闲计时器
function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  
  // 只在生产环境启用自动断开
  if (process.env.NODE_ENV === 'production') {
    idleTimer = setTimeout(async () => {
      try {
        if (!client.ended) {
          console.log('🔄 Auto-closing idle database connections for Neon optimization');
          await client.end({ timeout: 5 });
        }
      } catch (error) {
        console.error('❌ Error during auto-close:', error);
      }
    }, IDLE_TIMEOUT);
  }
}

// 包装数据库操作以支持自动启停
export function withAutoReconnect<T extends any[], R>(
  operation: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    resetIdleTimer();
    
    try {
      return await operation(...args);
    } catch (error: any) {
      // 如果连接已关闭，记录信息但不重连（Neon 会自动处理）
      if (error?.code === 'CONNECTION_ENDED' || client.ended) {
        console.log('🔄 Database connection ended, Neon will auto-reconnect on next query');
      }
      throw error;
    }
  };
}

// 优雅关闭数据库连接
export async function closeConnection() {
  try {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    
    if (!client.ended) {
      await client.end({ timeout: 10 });
      console.log('✅ Database connection closed gracefully');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
}

// 设置优雅关闭处理
if (typeof process !== 'undefined') {
  const gracefulShutdown = async () => {
    console.log('🔄 Shutting down database connections...');
    await closeConnection();
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('beforeExit', gracefulShutdown);
}