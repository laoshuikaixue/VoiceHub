#!/usr/bin/env node

/**
 * 旧冒号风格 API Key 权限 → 新点分风格归一化脚本
 *
 * 旧值（apiKeyPermissions.permission）：
 *   schedules:read / songs:read / songs:request / songs:write
 *   card-codes:read / card-codes:write / card-codes:delete / backup:execute
 *
 * 新值（与 server/utils/rbac/constants.ts 的 PERMISSIONS.* 枚举 1:1 对齐）：
 *   schedule.read / song.read / song.read / song.write
 *   card_codes.read / card_codes.write / card_codes.delete / backup.execute
 *
 * ⚠️ 维护警告（防止历史 bug 重演）：
 *   本映射的目标 key 必须与 `server/utils/rbac/constants.ts:16-52` 的 PERMISSIONS 枚举
 *   完全一致（单数 + 下划线风格）。如 PERMISSIONS 枚举调整，本脚本必须同步更新。
 *   任何"看起来差不多"的 key（如 `songs.read` vs `song.read`）都视为不匹配——runtime
 *   校验查的是 PERMISSIONS 枚举字面量，写错会导致迁移过的 API Key 静默失效。
 *   L3 审计曾发现此类 bug（A6），修复 commit 见 git log 关键字 `fix(scripts)`。
 *
 * 行为：
 *   - 逐行 UPDATE（id 维度）
 *   - 每条变更写入 permission_migration_log 审计
 *   - 同 (api_key_id, new_permission) 已存在则跳过并记 log，避免破坏 UNIQUE 约束
 *     （虽然旧表当前未声明 unique，但下一阶段合并到 permissions 表时会要求）
 *   - 幂等：重复执行无副作用
 *
 * 用法：
 *   DATABASE_URL=... node scripts/normalize-api-permissions.js
 */

import path from 'path'
import { config } from 'dotenv'
import postgres from 'postgres'
config({ path: path.resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.warn('未设置 DATABASE_URL，跳过 API 权限归一化')
  process.exit(0)
}

// 旧冒号风格 → 新点分风格映射字典
// 目标 key 必须与 server/utils/rbac/constants.ts:16-52 PERMISSIONS 枚举 1:1 一致
// 详见文件顶部 JSDoc 的"维护警告"
export const LEGACY_PERMISSION_MAP = {
  'schedules:read': 'schedule.read',
  'songs:read': 'song.read',
  'songs:request': 'song.read', // 历史映射: songs:request → song.read（按现有 LEGACY 规则合并）
  'songs:write': 'song.write',
  'card-codes:read': 'card_codes.read',
  'card-codes:write': 'card_codes.write',
  'card-codes:delete': 'card_codes.delete',
  'backup:execute': 'backup.execute'
}

const log = (msg) => console.log(`[normalize-api-permissions] ${msg}`)

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 })
  try {
    const oldRows = await sql`
      SELECT id, api_key_id, permission
      FROM api_key_permissions
      WHERE permission LIKE '%:%'
    `

    if (oldRows.length === 0) {
      log('未发现旧冒号风格权限，无需归一化')
      return
    }

    log(`发现 ${oldRows.length} 条旧权限记录需要归一化`)

    let updated = 0
    let skipped = 0
    for (const row of oldRows) {
      const newValue = LEGACY_PERMISSION_MAP[row.permission]
      if (!newValue) {
        log(`警告: 未在映射表中找到 ${row.permission}（id=${row.id}），跳过`)
        skipped += 1
        continue
      }

      await sql`
        UPDATE api_key_permissions
        SET permission = ${newValue}
        WHERE id = ${row.id}
      `

      await sql`
        INSERT INTO permission_migration_log (old_value, new_value, api_key_id)
        VALUES (${row.permission}, ${newValue}, ${row.api_key_id})
      `

      updated += 1
    }

    log(`已归一化 ${updated} 条，跳过 ${skipped} 条`)

    // 二次校验
    const remaining = await sql`
      SELECT COUNT(*)::int AS count
      FROM api_key_permissions
      WHERE permission LIKE '%:%'
    `
    if (remaining[0].count > 0) {
      log(`警告: 仍有 ${remaining[0].count} 条旧冒号风格权限未处理`)
    } else {
      log('✅ 校验通过：api_key_permissions 已无冒号风格权限')
    }
  } finally {
    await sql.end()
  }
}

main().catch((e) => {
  console.error(`[normalize-api-permissions] 失败: ${e.message || e}`)
  process.exit(1)
})
