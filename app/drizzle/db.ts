import {drizzle} from 'drizzle-orm/postgres-js';
import {and, asc, count, desc, eq, exists, gt, gte, lt, lte, ne, or, sql} from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.ts';
import {config} from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';
import { useEvent } from 'nitropack/runtime';
import { getHyperdriveConnectionString } from '#voicehub-cloudflare-bindings';
import {
  resolveDatabaseConnectionString,
  resolveDatabasePoolConfig
} from './runtime-config.ts';

// 加载环境变量（优先使用工作目录的 .env，确保构建后运行时能正确加载）
config({ path: path.resolve(process.cwd(), '.env') });

// 检查环境变量
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 创建PostgreSQL连接
const directConnectionString = process.env.DATABASE_URL;

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

const databaseHostname = getDatabaseHostname(directConnectionString);
const isNeonDatabase =
  isDomainOrSubdomain(databaseHostname, 'neon.tech') ||
  isDomainOrSubdomain(databaseHostname, 'neon.database.com');

// Cloudflare 优先使用 Hyperdrive；未绑定时回退 DATABASE_URL 直连。
// 注意：Workers 下 env 绑定（含 HYPERDRIVE）只允许在请求处理器内访问，
// 模块顶层读取会触发部署校验 10021（Disallowed operation called within global scope），
// 因此连接串解析、client 与 drizzle 实例全部延迟到首次请求（见 getInstances）。
const resolveRuntimeOptions = () => {
  const isCloudflareRuntime =
    typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
  const hyperdriveConnectionString = isCloudflareRuntime
    ? getHyperdriveConnectionString()
    : undefined;
  const runtimeOptions = {
    isCloudflare: isCloudflareRuntime,
    databaseUrl: directConnectionString,
    hyperdriveUrl: hyperdriveConnectionString,
    isNeon: isNeonDatabase
  };
  return {
    isCloudflareRuntime,
    isNeonDatabase,
    connectionString: resolveDatabaseConnectionString(runtimeOptions),
    runtimePoolConfig: resolveDatabasePoolConfig(runtimeOptions)
  };
};

// 根据数据库类型选择配置
const getDatabaseConfig = (runtime: ReturnType<typeof resolveRuntimeOptions>) => {
  const { isCloudflareRuntime, connectionString, runtimePoolConfig } = runtime;
  if (isCloudflareRuntime) {
    return {
      ...runtimePoolConfig,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('ssl=true') ? 'require' : false,
      prepare: false,
      transform: { undefined: null },
      connection: { application_name: 'voicehub-app' },
      onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
      debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true'
    };
  }

  if (isNeonDatabase) {
    // Neon Database Serverless 优化配置
    return {
      ...runtimePoolConfig,
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
      ...runtimePoolConfig,
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

// 惰性初始化：模块顶层只做无副作用准备，首次使用时才创建连接（Workers 下才能访问 env 绑定）
type DbInstances = {
  client: ReturnType<typeof postgres>
  db: ReturnType<typeof drizzle>
}

const isCloudflareWorkerRuntime = () =>
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

function createInstances(): DbInstances {
  const runtime = resolveRuntimeOptions();
  const created = postgres(runtime.connectionString, getDatabaseConfig(runtime));
  return { client: created, db: drizzle(created, { schema }) };
}

// Workers（stateless）下连接不得跨请求存活：socket 与定时器归属于创建请求的上下文，
// 请求结束后 I/O 被取消，后续请求复用会产生跨请求 promise resolve 警告或请求挂死。
// 因此按 H3Event 维度缓存实例，响应结束后由 error-handler 插件的 afterResponse 钩子关闭。
const workerInstances = new WeakMap<object, DbInstances>();
let nodeInstances: DbInstances | null = null;

function tryCurrentEvent(): object | undefined {
  try {
    return useEvent() as unknown as object;
  } catch {
    return undefined;
  }
}

function getInstances(): DbInstances {
  if (!isCloudflareWorkerRuntime()) {
    if (!nodeInstances) nodeInstances = createInstances();
    return nodeInstances;
  }
  const event = tryCurrentEvent();
  // Workers 下所有数据库访问必须发生在请求处理器内：
  // 无请求上下文的实例无法按请求回收（socket 归属创建请求），禁止创建可复用的共享实例
  if (!event) {
    throw new Error(
      '数据库访问发生在 Workers 请求上下文之外，无法创建可回收的连接；请在事件处理器内访问 db/client'
    );
  }
  let inst = workerInstances.get(event);
  if (!inst) {
    inst = createInstances();
    workerInstances.set(event, inst);
  }
  return inst;
}

// 请求结束时关闭该请求的数据库客户端（Workers 专用，由 afterResponse 钩子调用）
export async function closeRequestDb(event: object) {
  const inst = workerInstances.get(event);
  if (!inst || inst.client.ended) return;
  workerInstances.delete(event);
  try {
    await inst.client.end({ timeout: 1 });
  } catch {
    // 关闭失败不影响响应，socket 会随请求上下文销毁
  }
}

// 首次请求前不触碰连接；属性读取、调用（含标签模板）都转发到惰性实例
function lazyProxy<T extends object>(resolve: () => T): T {
  const callable = function () {} as T;
  return new Proxy(callable, {
    apply(_target, thisArg, args) {
      return (resolve() as unknown as (...fnArgs: unknown[]) => unknown).apply(thisArg, args);
    },
    get(_target, prop, receiver) {
      const value = Reflect.get(resolve(), prop, resolve());
      return typeof value === 'function' ? value.bind(resolve()) : value;
    },
    has(_target, prop) {
      return Reflect.has(resolve(), prop);
    }
  }) as T;
}

// 创建Drizzle数据库实例
export const db = lazyProxy<ReturnType<typeof drizzle>>(() => getInstances().db);

// 导出连接客户端（用于手动查询或关闭连接）
export const client = lazyProxy<ReturnType<typeof postgres>>(() => getInstances().client);

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
  // Workers 下连接按请求创建与关闭（见 closeRequestDb），空闲自动断开无意义
  if (isCloudflareWorkerRuntime()) return;
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

// 设置优雅关闭处理（仅 Node 运行时；Workers 全局作用域禁止事件/信号操作且无意义）
const isCloudflareWorker =
  typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
if (typeof process !== 'undefined' && !isCloudflareWorker) {
  const gracefulShutdown = async () => {
    console.log('🔄 Shutting down database connections...');
    await closeConnection();
  };
  
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('beforeExit', gracefulShutdown);
}
