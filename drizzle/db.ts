import {drizzle} from 'drizzle-orm/postgres-js';
import {and, asc, count, desc, eq, exists, gte, lt, or} from 'drizzle-orm';
import {sql} from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.ts';
import {config} from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

// 加载环境变量
const currentDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(currentDir, '../.env') });

// 检查环境变量
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 创建PostgreSQL连接
const connectionString = process.env.DATABASE_URL;

// 检测数据库类型
const isNeonDatabase = connectionString.includes('neon.tech') || connectionString.includes('neon.database.com');

// 根据数据库类型选择配置
const getDatabaseConfig = (maxOverride?: number) => {
  if (isNeonDatabase) {
    // Neon Database Serverless 优化配置
    return {
      max: typeof maxOverride === 'number' ? maxOverride : (process.env.NODE_ENV === 'production' ? 3 : 5),
      idle_timeout: 10, // 快速释放空闲连接，支持自动启停
      connect_timeout: 10, // Neon 连接速度快，减少超时时间
      max_lifetime: 3600, // 连接最大生命周期（1小时）
      ssl: 'require', // Neon 默认需要 SSL
      prepare: false, // 禁用预处理语句以提高兼容性
      transform: {
        undefined: null, // 将undefined转换为null
      },
      connection: {
        application_name: 'voicehub-app'
      },
      onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
      debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
    };
  } else {
    // 标准 PostgreSQL 数据库配置
    return {
      max: typeof maxOverride === 'number' ? maxOverride : (process.env.NODE_ENV === 'production' ? 10 : 5),
      idle_timeout: 20, // 增加空闲超时时间
      connect_timeout: 30, // 增加连接超时时间以适应网络延迟
      max_lifetime: 3600, // 连接最大生命周期（1小时）
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('ssl=true') ? 'require' : false,
      prepare: false, // 禁用预处理语句以提高兼容性
      transform: {
        undefined: null, // 将undefined转换为null
      },
      connection: {
        application_name: 'voicehub-app'
      },
      onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
      debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
    };
  }
};

const envPoolMinRaw = process.env.DB_POOL_MIN;
const envPoolMaxRaw = process.env.DB_POOL_MAX;
const envPoolMin = envPoolMinRaw ? parseInt(envPoolMinRaw, 10) : NaN;
const envPoolMax = envPoolMaxRaw ? parseInt(envPoolMaxRaw, 10) : NaN;
const defaultMax = isNeonDatabase ? (process.env.NODE_ENV === 'production' ? 3 : 5) : (process.env.NODE_ENV === 'production' ? 10 : 5);
let currentMax = Number.isFinite(envPoolMax) ? envPoolMax : defaultMax;
const minMax = Number.isFinite(envPoolMin) ? envPoolMin : (isNeonDatabase ? (process.env.NODE_ENV === 'production' ? 2 : 3) : (process.env.NODE_ENV === 'production' ? 5 : 3));
let client = postgres(connectionString, getDatabaseConfig(currentMax));

// 创建Drizzle数据库实例
export let db = drizzle(client, { schema });

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

async function reconfigurePool(newMax: number) {
  if (!Number.isFinite(newMax)) return;
  if (newMax === currentMax) return;
  const oldClient = client;
  const newClient = postgres(connectionString, getDatabaseConfig(newMax));
  const newDb = drizzle(newClient, { schema });
  client = newClient;
  db = newDb;
  currentMax = newMax;
  try {
    if (!oldClient.ended) await oldClient.end({ timeout: 5 });
  } catch {}
}

const adaptIntervalMs = 30000;
if (process.env.DB_POOL_ADAPTIVE === 'true') {
  setInterval(async () => {
    try {
      const rows = await client`select count(*)::int as total from pg_stat_activity where datname = current_database()`;
      const total = rows && rows[0] && (rows[0] as any).total ? (rows[0] as any).total as number : 0;
      const upThreshold = Math.max(1, Math.floor(currentMax * 0.7));
      const downThreshold = Math.max(1, Math.floor(currentMax * 0.3));
      if (total > upThreshold && currentMax < (Number.isFinite(envPoolMax) ? envPoolMax : defaultMax)) {
        const step = Math.max(1, Math.floor(currentMax * 0.5));
        await reconfigurePool(Math.min(Number.isFinite(envPoolMax) ? envPoolMax : defaultMax, currentMax + step));
      } else if (total < downThreshold && currentMax > minMax) {
        const step = Math.max(1, Math.floor(currentMax * 0.5));
        await reconfigurePool(Math.max(minMax, currentMax - step));
      }
    } catch {}
  }, adaptIntervalMs);
}

export async function withStatementTimeout<R>(ms: number, operation: (tx: any) => Promise<R>): Promise<R> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = ${ms}`);
    return await operation(tx);
  });
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