import {drizzle} from 'drizzle-orm/postgres-js';
import {and, asc, count, desc, eq, exists, gt, gte, lt, lte, ne, or, sql} from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.ts';
import {config} from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';
import {isServerlessRuntime} from '../../server/utils/serverless-runtime';

// 加载环境变量（优先使用工作目录的 .env，确保构建后运行时能正确加载）
config({ path: path.resolve(process.cwd(), '.env') });

// 无时区 timestamp 列按 Node 本地时区解析，非 UTC 容器会导致读出时刻整体偏移；
// 展示层已统一用 Asia/Shanghai 显式转换，不依赖容器时区
process.env.TZ = 'UTC';

// 检查环境变量
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 创建PostgreSQL连接
const connectionString = process.env.DATABASE_URL;

// 检测数据库类型
const getDatabaseHostname = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
};

const isDomainOrSubdomain = (hostname: string, domain: string) => {
  return hostname === domain || hostname.endsWith(`.${domain}`);
};

const databaseHostname = getDatabaseHostname(connectionString);
const isNeonDatabase =
  isDomainOrSubdomain(databaseHostname, 'neon.tech') ||
  isDomainOrSubdomain(databaseHostname, 'neon.database.com');

// Serverless 部署（每个函数实例独立建池，必须压低单实例连接数，防止实例数×池大小超过数据库 max_connections）
// 判定与备份导出、群事件投递器共用一份，此前这里漏掉了 VERCEL_ENV 与 NITRO_PRESET
const isServerlessDatabase = isServerlessRuntime();

// 根据数据库类型选择配置
const getDatabaseConfig = () => {
  if (isNeonDatabase) {
    // Neon Database Serverless 优化配置
    return {
      max: 1, // Serverless 环境下每个实例保持最小连接数，利用 Neon 自身的连接池
      idle_timeout: 0, // 立即释放空闲连接，适应 Serverless 的快速冻结特性
      connect_timeout: 10, // Neon 连接速度快，减少超时时间
      max_lifetime: 3600, // 连接最大生命周期（1小时）
      ssl: 'require', // Neon 默认需要 SSL
      prepare: false, // 禁用预处理语句以提高兼容性
      transform: {
        undefined: null, // 将undefined转换为null
      },
      connection: {
        application_name: 'voicehub-app',
        // 强制会话时区为 UTC：数据库容器 TZ 非 UTC 时（如自建设为 Asia/Shanghai），
        // defaultNow() 写入无时区 timestamp 列的会是北京墙钟，前端展示会整体 +8 偏移到次日
        timezone: 'UTC'
      },
      onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
      debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
    };
  } else {
    // 标准 PostgreSQL 数据库配置
    return {
      // Serverless 下单实例池压到 2：1 vCPU 数据库同时只能执行一条查询，大池只会耗尽 max_connections
      max: isServerlessDatabase ? 2 : process.env.NODE_ENV === 'production' ? 10 : 5,
      idle_timeout: 20, // 增加空闲超时时间
      // Serverless 下连接阶段压到 8s，与 statement_timeout 10s 一起留在平台 30s 量级的硬超时之内
      connect_timeout: isServerlessDatabase ? 8 : 30,
      max_lifetime: 3600, // 连接最大生命周期（1小时）
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('ssl=true') ? 'require' : false,
      prepare: false, // 禁用预处理语句以提高兼容性
      transform: {
        undefined: null, // 将undefined转换为null
      },
      connection: {
        application_name: 'voicehub-app',
        // 强制会话时区为 UTC，同 Neon 分支说明
        timezone: 'UTC',
        // Serverless 下给单条语句设上界，让它先于函数平台的硬超时失败；自建库不限制，备份/恢复是长查询。
        // postgres-js 3.x 顶层 timeout 已废弃（被当作 idle_timeout），不能当查询超时用
        ...(isServerlessDatabase ? { statement_timeout: '10s' } : {})
      },
      onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
      debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
    };
  }
};

const client = postgres(connectionString, getDatabaseConfig());

// 创建Drizzle数据库实例
export const db = drizzle(client, { schema });

// 导出连接客户端（用于手动查询或关闭连接）
export { client };

// 导出schema以便在其他地方使用
export * from './schema.ts';

// 导出drizzle-orm函数
export {eq, ne, and, gt, gte, lt, lte, count, exists, desc, asc, or, sql};

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
  const isConnected = !client.ended;

  return {
    isConnected,
    connected: isConnected,
    status: isConnected ? 'connected' : 'disconnected',
    maxConnections: client.options.max,
    idleTimeout: client.options.idle_timeout,
    connectTimeout: client.options.connect_timeout
  };
}

// 连接管理 - 根据数据库类型自适应
let idleTimer: NodeJS.Timeout | null = null;
// Neon 数据库使用更短的空闲时间以支持自动启停，普通 PostgreSQL 使用更长的空闲时间
const IDLE_TIMEOUT = isNeonDatabase ? 5 * 60 * 1000 : 10 * 60 * 1000; // Neon: 5分钟，PostgreSQL: 10分钟

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
          const dbType = isNeonDatabase ? 'Neon' : 'PostgreSQL';
          console.log(`🔄 Auto-closing idle ${dbType} database connections${isNeonDatabase ? ' for Serverless optimization' : ''}`);
          await client.end({ timeout: isNeonDatabase ? 5 : 10 });
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
      // 如果连接已关闭，记录信息
      if (error?.code === 'CONNECTION_ENDED' || client.ended) {
        const dbType = isNeonDatabase ? 'Neon' : 'PostgreSQL';
        console.log(`🔄 ${dbType} database connection ended${isNeonDatabase ? ', Neon will auto-reconnect on next query' : ', will reconnect on next query'}`);
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
