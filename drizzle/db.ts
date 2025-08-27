import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, gte, lt, count } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';

// 检查环境变量
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 创建PostgreSQL连接
const connectionString = process.env.DATABASE_URL;

// 配置连接池 - 优化云平台部署
const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 5 : 10, // 生产环境减少连接数
  idle_timeout: 20, // 空闲超时时间（秒）
  connect_timeout: 30, // 增加连接超时时间适配云平台
  ssl: connectionString.includes('sslmode=require') ? 'require' : false,
  prepare: false, // 禁用预处理语句以提高兼容性
  transform: {
    undefined: null, // 将undefined转换为null
  },
  connection: {
    application_name: 'voicehub-app', // 应用标识
  },
});

// 创建Drizzle数据库实例
export const db = drizzle(client, { schema });

// 导出连接客户端（用于手动查询或关闭连接）
export { client };

// 导出schema以便在其他地方使用
export * from './schema';

// 导出drizzle-orm函数
export { eq, and, gte, lt, count };

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

// 优雅关闭数据库连接
export async function closeConnection() {
  try {
    await client.end();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
}