#!/usr/bin/env node

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { client, db, notificationSettings, systemSettings, users } from '../app/drizzle/db.ts'
import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置')
  process.exit(1)
}

async function main() {
  try {
    // 检查是否已有超级管理员
    const existingSuperAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))
      .limit(1)

    if (existingSuperAdmin.length > 0) {
      console.log('✅ 管理员已存在')
      return existingSuperAdmin[0]
    }

    // 创建管理员
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const [admin] = await db
      .insert(users)
      .values({
        username: 'admin',
        name: '超级管理员',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        forcePasswordChange: false
      })
      .returning()

    // 创建通知设置
    await db
      .insert(notificationSettings)
      .values({
        userId: admin.id,
        enabled: true,
        songRequestEnabled: true,
        songVotedEnabled: true,
        songPlayedEnabled: true,
        refreshInterval: 60,
        songVotedThreshold: 1
      })
      .onConflictDoNothing()

    // 创建系统设置
    await db
      .insert(systemSettings)
      .values({
        id: 1,
        enablePlayTimeSelection: false
      })
      .onConflictDoNothing()

    console.log('✅ 管理员创建成功 (admin/admin123)')
    return admin
  } catch (error) {
    console.error('❌ 创建管理员失败:', error)
    throw error
  }
}

main()
  .then(async () => {
    await client.end()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('❌ 初始化失败:', error)
    await client.end()
    process.exit(1)
  })
