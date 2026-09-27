#!/usr/bin/env node

/**
 * 旧冒号风格 API Key 权限 → catalog key 归一化（S1-4 · R-09 / R-32）。
 *
 * 映射表**唯一来源**：`shared/rbac/permission-catalog.js` 的 `LEGACY_PERMISSION_MAP`
 * （本文件不再抄第二份；上一轮 7/8 条目标 key 写成 songs.read / card-codes.* 导致历史
 * API Key 全量静默 403，catalog 是该事故的根因修复点）。
 *
 * 行为：
 *   - 逐行处理 `api_key_permissions`：permission 不是 catalog key 时按 legacy 映射改写；
 *   - **去重**（JSDoc 早已声明、上一轮未实现）：同 apiKeyId 下目标 key 已存在则删除旧行并记审计；
 *   - 每次改写写 `permission_migration_log` 审计（oldValue / newValue / apiKeyId）；
 *   - 幂等：重复执行无副作用；未识别的值**不做猜测**，直接非零退出（防止「看起来差不多」的 key 漏网）。
 *
 * 用法：
 *   pnpm exec tsx scripts/normalize-api-permissions.js
 *   DATABASE_URL=... node scripts/normalize-api-permissions.js
 */

import path from 'node:path'
import { config } from 'dotenv'
import postgres from 'postgres'
import { LEGACY_PERMISSION_MAP, normalizePermission } from '../shared/rbac/permission-catalog.js'

config({ path: path.resolve(process.cwd(), '.env') })

const log = (message) => console.log(`[normalize-api-permissions] ${message}`)

// 归一化必须真的写库；无 DATABASE_URL 时按错误退出，禁止「跳过」这种静默降级（R-21）
if (!process.env.DATABASE_URL) {
  throw new Error('[normalize-api-permissions] 未设置 DATABASE_URL：归一化脚本拒绝静默跳过')
}

/** legacy 词表条数（供日志核对，实际映射来自 catalog） */
const LEGACY_ENTRY_COUNT = Object.keys(LEGACY_PERMISSION_MAP).length

async function main() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 })

  try {
    const rows = await sql`
      SELECT id, api_key_id, permission
      FROM api_key_permissions
      ORDER BY api_key_id, id
    `

    const rewritable = []
    const duplicated = []
    const unknown = []
    let already = 0

    for (const row of rows) {
      const normalized = normalizePermission(row.permission)
      if (normalized === null) {
        unknown.push(row)
        continue
      }
      if (normalized === row.permission) {
        already += 1
        continue
      }
      const clash = rows.some(
        (other) => other.api_key_id === row.api_key_id && other.permission === normalized
      )
      ;(clash ? duplicated : rewritable).push({ ...row, normalized })
    }

    if (unknown.length > 0) {
      const list = unknown
        .map((row) => `${row.id}(${row.api_key_id}): ${row.permission}`)
        .join('; ')
      throw new Error(
        `发现 ${unknown.length} 条无法归一化的权限值（catalog 无对应 key，禁止猜测）：${list}`
      )
    }

    if (rewritable.length === 0 && duplicated.length === 0) {
      log(`无需归一化（已合规 ${already} 条，legacy 词表 ${LEGACY_ENTRY_COUNT} 条）`)
      return
    }

    await sql.begin(async (tx) => {
      for (const row of rewritable) {
        await tx`UPDATE api_key_permissions SET permission = ${row.normalized} WHERE id = ${row.id}`
        await tx`
          INSERT INTO permission_migration_log ("oldValue", "newValue", "apiKeyId")
          VALUES (${row.permission}, ${row.normalized}, ${row.api_key_id})
        `
      }
      for (const row of duplicated) {
        // 目标 key 已存在：同一 (apiKeyId, key) 不允许两行，删旧留新并记审计
        await tx`DELETE FROM api_key_permissions WHERE id = ${row.id}`
        await tx`
          INSERT INTO permission_migration_log ("oldValue", "newValue", "apiKeyId")
          VALUES (${row.permission}, ${row.normalized}, ${row.api_key_id})
        `
      }
    })

    const remaining = await sql`
      SELECT count(*)::int AS count
      FROM api_key_permissions
      WHERE permission LIKE '%:%'
    `
    if (remaining[0].count > 0) {
      throw new Error(`归一化后仍有 ${remaining[0].count} 条冒号风格权限（请检查映射表）`)
    }

    log(
      `✔ 改写 ${rewritable.length} 条，去重删除 ${duplicated.length} 条，` +
        `原本合规 ${already} 条（legacy 词表 ${LEGACY_ENTRY_COUNT} 条）`
    )
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(`[normalize-api-permissions] ✖ ${error.message || error}`)
  process.exit(1)
})
