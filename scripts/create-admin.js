#!/usr/bin/env node

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { client, db, notificationSettings, systemSettings, users } from '../app/drizzle/db.ts'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置')
  process.exit(1)
}

const DEFAULT_ADMIN_PASSWORD = 'admin123'

/**
 * 仍在校验默认口令的超级管理员按临时密码对待，置首次登录强制改密标记。
 * 无密码账号（如 OAuth 创建）与已改密账号不受影响，已标记的不重复写入。
 */
async function markDefaultPasswordSuperAdmins(accounts) {
  for (const account of accounts) {
    if (!account.password || account.forcePasswordChange) continue
    if (!(await bcrypt.compare(DEFAULT_ADMIN_PASSWORD, account.password))) continue
    await db
      .update(users)
      .set({ forcePasswordChange: true })
      .where(eq(users.id, account.id))
    console.warn(
      `⚠️ 超级管理员 #${account.id}（${account.username}）仍在使用默认口令，已标记首次登录强制修改密码`
    )
  }
}

async function main() {
  try {
    // 检查是否已有超级管理员
    const existingSuperAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'SUPER_ADMIN'))

    if (existingSuperAdmin.length > 0) {
      await markDefaultPasswordSuperAdmins(existingSuperAdmin)
      console.log('✅ 管理员已存在')
      return existingSuperAdmin[0]
    }

    // 没有超级管理员但 username=admin 已被其他角色占用时跳过创建，避免产生重复 username
    const existingAdminName = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1)

    if (existingAdminName.length > 0) {
      console.warn(
        `⚠️ username=admin 已被用户#${existingAdminName[0].id}（role=${existingAdminName[0].role}）占用，跳过创建管理员`
      )
      return existingAdminName[0]
    }

    // 创建管理员
    // 默认口令属公开信息，按临时密码对待：与后台重置密码一致，首次登录强制设置新密码
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10)
    const [admin] = await db
      .insert(users)
      .values({
        username: 'admin',
        name: '超级管理员',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        forcePasswordChange: true
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

    console.log('✅ 管理员创建成功 (admin/admin123)，首次登录需设置新密码')
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
