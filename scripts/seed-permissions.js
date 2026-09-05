#!/usr/bin/env node

/**
 * 写入 RBAC 权限种子数据：
 *   1. permissions 表：所有权限定义（含 8 项旧 API 权限的点分风格 key）
 *   2. role_permissions 表：USER / SONG_ADMIN / ADMIN / SUPER_ADMIN 矩阵
 *   3. 幂等：重复执行不报错
 *
 * 用法：
 *   - 自动调用：通过 pnpm db:seed 或 safe-migrate 末尾
 *   - 手动：DATABASE_URL=... node scripts/seed-permissions.js
 */

import path from 'path'
import { config } from 'dotenv'
import postgres from 'postgres'
config({ path: path.resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.warn('未设置 DATABASE_URL，跳过权限种子写入')
  process.exit(0)
}

// 全部权限定义（category / key / 中文描述 / 英文描述 / 是否 API 可用）
const PERMISSIONS = [
  // user 域
  { category: 'user', key: 'user.read', zh: '查看用户', en: 'View users', isApi: false },
  { category: 'user', key: 'user.manage', zh: '管理用户（创建/修改/删除）', en: 'Manage users', isApi: false },
  { category: 'user', key: 'user.status', zh: '调整用户状态', en: 'Change user status', isApi: false },
  // song 域
  { category: 'song', key: 'song.read', zh: '查看歌曲', en: 'View songs', isApi: true },
  { category: 'song', key: 'song.write', zh: '审核 / 处理歌曲', en: 'Process songs', isApi: true },
  { category: 'song', key: 'song.reject', zh: '拒绝投稿', en: 'Reject submissions', isApi: false },
  // schedule 域
  { category: 'schedule', key: 'schedule.read', zh: '查看排期', en: 'View schedules', isApi: true },
  { category: 'schedule', key: 'schedule.write', zh: '编辑排期', en: 'Edit schedules', isApi: false },
  { category: 'schedule', key: 'schedule.publish', zh: '发布排期', en: 'Publish schedules', isApi: false },
  // playtimes / request_times / semester 域
  { category: 'playtimes', key: 'playtimes.manage', zh: '管理播出时段', en: 'Manage play times', isApi: false },
  { category: 'request_times', key: 'request_times.manage', zh: '管理投稿时段', en: 'Manage request times', isApi: false },
  { category: 'semester', key: 'semester.manage', zh: '管理学期', en: 'Manage semesters', isApi: false },
  // stats 域
  { category: 'stats', key: 'stats.read', zh: '查看数据统计', en: 'View statistics', isApi: false },
  // card_codes 域
  { category: 'card_codes', key: 'card_codes.read', zh: '查看卡密', en: 'View card codes', isApi: true },
  { category: 'card_codes', key: 'card_codes.write', zh: '生成 / 修改卡密', en: 'Create / modify card codes', isApi: true },
  { category: 'card_codes', key: 'card_codes.delete', zh: '删除卡密', en: 'Delete card codes', isApi: true },
  // blacklist / system_settings / email / smtp / grade_class / backup / notification
  { category: 'blacklist', key: 'blacklist.manage', zh: '管理黑名单', en: 'Manage blacklist', isApi: false },
  { category: 'system_settings', key: 'system_settings.read', zh: '查看系统设置', en: 'View system settings', isApi: false },
  { category: 'system_settings', key: 'system_settings.write', zh: '修改系统设置', en: 'Modify system settings', isApi: false },
  { category: 'email_templates', key: 'email_templates.manage', zh: '管理邮件模板', en: 'Manage email templates', isApi: false },
  { category: 'smtp', key: 'smtp.manage', zh: '管理 SMTP', en: 'Manage SMTP', isApi: false },
  { category: 'grade_class', key: 'grade_class.manage', zh: '管理年级班级', en: 'Manage grade & class', isApi: false },
  { category: 'backup', key: 'backup.execute', zh: '执行备份', en: 'Execute backup', isApi: true },
  { category: 'backup', key: 'backup.export', zh: '导出备份', en: 'Export backup', isApi: false },
  { category: 'backup', key: 'backup.restore', zh: '恢复备份', en: 'Restore backup', isApi: false },
  { category: 'database', key: 'database.reset', zh: '重置数据库', en: 'Reset database', isApi: false },
  { category: 'notification', key: 'notification.send', zh: '发送系统通知', en: 'Send system notifications', isApi: false },
  // api_keys 域
  { category: 'api_keys', key: 'api_keys.read', zh: '查看 API Key', en: 'View API keys', isApi: false },
  { category: 'api_keys', key: 'api_keys.write', zh: '创建 / 修改 API Key', en: 'Create / modify API keys', isApi: false },
  { category: 'api_keys', key: 'api_keys.delete', zh: '删除 API Key', en: 'Delete API keys', isApi: false },
  { category: 'api_keys', key: 'api_keys.manage', zh: '查看 API Key 统计与异常', en: 'View API key statistics', isApi: false },
  // rbac 域（仅 SUPER_ADMIN）
  { category: 'rbac', key: 'role.manage', zh: '管理角色权限矩阵', en: 'Manage role-permission matrix', isApi: false },
  { category: 'rbac', key: 'user_permissions.manage', zh: '管理用户加授', en: 'Manage user permission grants', isApi: false },
  { category: 'rbac', key: 'permissions.read', zh: '查看权限目录', en: 'View permission catalog', isApi: false },
  { category: 'rbac', key: 'permissions.manage', zh: '管理权限目录', en: 'Manage permission catalog', isApi: false }
]

// 角色 × 权限矩阵
const ROLE_MATRIX = {
  USER: [],
  SONG_ADMIN: [
    'song.read',
    'song.write',
    'song.reject',
    'schedule.read',
    'schedule.write',
    'schedule.publish',
    'playtimes.manage',
    'request_times.manage',
    'semester.manage',
    'stats.read',
    'card_codes.read',
    'card_codes.write'
  ],
  ADMIN: [
    // SONG_ADMIN 全集
    'song.read',
    'song.write',
    'song.reject',
    'schedule.read',
    'schedule.write',
    'schedule.publish',
    'playtimes.manage',
    'request_times.manage',
    'semester.manage',
    'stats.read',
    'card_codes.read',
    'card_codes.write',
    // 增量
    'user.read',
    'user.manage',
    'user.status',
    'blacklist.manage',
    'system_settings.read',
    'email_templates.manage',
    'smtp.manage',
    'grade_class.manage',
    'backup.execute',
    'notification.send',
    'api_keys.read',
    'api_keys.write',
    'api_keys.manage',
    'permissions.read'
  ],
  SUPER_ADMIN: [
    // ADMIN 全集
    'song.read',
    'song.write',
    'song.reject',
    'schedule.read',
    'schedule.write',
    'schedule.publish',
    'playtimes.manage',
    'request_times.manage',
    'semester.manage',
    'stats.read',
    'card_codes.read',
    'card_codes.write',
    'user.read',
    'user.manage',
    'user.status',
    'blacklist.manage',
    'system_settings.read',
    'email_templates.manage',
    'smtp.manage',
    'grade_class.manage',
    'backup.execute',
    'notification.send',
    'api_keys.read',
    'api_keys.write',
    'api_keys.manage',
    'permissions.read',
    // 增量
    'role.manage',
    'user_permissions.manage',
    'permissions.manage',
    'system_settings.write',
    'backup.export',
    'backup.restore',
    'database.reset',
    'card_codes.delete',
    'api_keys.delete'
  ]
}

const log = (msg) => console.log(`[seed-permissions] ${msg}`)

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 })
  try {
    // 1. 写入 permissions
    let permCount = 0
    for (const p of PERMISSIONS) {
      await sql`
        INSERT INTO permissions (key, category, description_zh, description_en, is_api_permission, scope_expression)
        VALUES (${p.key}, ${p.category}, ${p.zh}, ${p.en}, ${p.isApi}, NULL)
        ON CONFLICT (key) DO UPDATE
        SET category = EXCLUDED.category,
            description_zh = EXCLUDED.description_zh,
            description_en = EXCLUDED.description_en,
            is_api_permission = EXCLUDED.is_api_permission
      `
      permCount += 1
    }
    log(`已写入 ${permCount} 项权限定义`)

    // 2. 写入 role_permissions
    const allPerms = await sql`SELECT id, key FROM permissions`
    const keyToId = new Map(allPerms.map((p) => [p.key, p.id]))
    let roleCount = 0
    for (const [role, keys] of Object.entries(ROLE_MATRIX)) {
      for (const key of keys) {
        const pid = keyToId.get(key)
        if (!pid) {
          log(`警告: 角色 ${role} 引用了不存在的权限 ${key}，跳过`)
          continue
        }
        await sql`
          INSERT INTO role_permissions (role, permission_id)
          VALUES (${role}, ${pid})
          ON CONFLICT DO NOTHING
        `
        roleCount += 1
      }
    }
    log(`已写入 ${roleCount} 项角色权限映射`)

    log('权限种子写入完成')
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(`[seed-permissions] 失败: ${e.message || e}`)
  process.exit(1)
})
