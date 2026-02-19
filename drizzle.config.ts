import type { Config } from 'drizzle-kit'

export default {
  out: './app/drizzle/migrations',
  schema: './app/drizzle/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  verbose: process.env.NODE_ENV === 'development',
  strict: false, // 避免在部署时出现交互式提示
  migrations: {
    prefix: 'timestamp', // 使用时间戳命名迁移文件
    table: '__drizzle_migrations__', // 迁移记录表
    schema: 'public'
  },
  introspect: {
    casing: 'camel'
  }
} satisfies Config
