#!/usr/bin/env node

/**
 * RBAC 权限 seed（S1-3 · D5 / R-04 / R-05 / R-21 / R-23）
 *
 * 数据来源：`shared/rbac/permission-catalog.js` —— 唯一权威。本文件不得出现任何权限 key
 * 字面量（R-32）：目录形（song.read）与旧冒号词表都在 catalog 内。
 *
 * 幂等策略（冻结，不得退化）：
 *   1. `permissions`      → INSERT ... ON CONFLICT (key) DO UPDATE（**显式 conflict target**）。
 *      严禁 ON CONFLICT DO NOTHING：老库里描述 / minRole 的修正会静默不生效（历史 403 事故成因之一）。
 *   2. `role_permissions` → 先 `DELETE WHERE role = $1` 再写回（**覆盖式收敛**，能表达降权删除）；
 *      INSERT 仍带 `ON CONFLICT (role, "permissionId") DO UPDATE` —— 显式 conflict target 是
 *      42P10 事故（旧实现 role_permissions 缺唯一约束）的直接防线，缺它会整条迁移/seed 崩。
 *   3. 写后自校验：`permissions` 行数 == catalog 条目数；每角色行数 == 派生矩阵长度。
 *
 * 失败一律非零退出（禁止静默跳过）：DATABASE_URL 缺失 / RBAC 表不存在（说明没走迁移链）/
 * catalog 为空 / 目录外遗留权限行 / 写后自校验不符。
 *
 * 用法：`pnpm db:seed`（等价 `node scripts/seed-permissions.js`）
 */

import path from 'node:path'
import { config } from 'dotenv'
import postgres from 'postgres'
import { PERMISSION_LIST, ROLE_ORDER, ROLE_PERMISSIONS } from '../shared/rbac/permission-catalog.js'

config({ path: path.resolve(process.cwd(), '.env') })

/** S1 冻结基线（改动即有意契约变更，须同步 tests/contract/permission-catalog.test.ts 与规划文档） */
const FROZEN_MATRIX_COUNTS = '0/12/25/35'

const log = (message) => console.log(`[seed-permissions] ${message}`)

/** 业务失败统一用本类抛出，便于与真实异常区分 */
class SeedError extends Error {}

async function writeSeed(sql) {
  const expectedByRole = Object.fromEntries(
    ROLE_ORDER.map((role) => [role, ROLE_PERMISSIONS[role].length])
  )

  // seed 不建表：表不存在说明没走唯一迁移链（D5：seed 只挂迁移链）
  const tables = await sql`
    SELECT to_regclass('public.permissions') AS permissions,
           to_regclass('public.role_permissions') AS role_permissions
  `
  if (!tables[0]?.permissions || !tables[0]?.role_permissions) {
    throw new SeedError('RBAC 表不存在：请先执行唯一迁移链 pnpm db:migrate（seed 不负责建表）')
  }

  await sql.begin(async (tx) => {
    // 1. permissions：显式 conflict target 的 upsert，逐条 RETURNING id 建立 key → id 映射
    const idByKey = new Map()
    for (const definition of PERMISSION_LIST) {
      const rows = await tx`
        INSERT INTO permissions (key, category, "descriptionZh", "descriptionEn", "minRole", "isApiPermission")
        VALUES (${definition.key}, ${definition.category}, ${definition.zh}, ${definition.en}, ${definition.minRole}, ${definition.isApiPermission})
        ON CONFLICT (key) DO UPDATE SET
          category = EXCLUDED.category,
          "descriptionZh" = EXCLUDED."descriptionZh",
          "descriptionEn" = EXCLUDED."descriptionEn",
          "minRole" = EXCLUDED."minRole",
          "isApiPermission" = EXCLUDED."isApiPermission"
        RETURNING id
      `
      idByKey.set(definition.key, rows[0].id)
    }

    // 2. 目录外遗留权限行：不自动删除（会级联删掉 user_permissions 的个人加授），改为硬失败要求人工确认
    const catalogKeys = PERMISSION_LIST.map((definition) => definition.key)
    const stale = await tx`
      SELECT key FROM permissions
      WHERE NOT (key = ANY(${catalogKeys}::text[]))
      ORDER BY key
    `
    if (stale.length > 0) {
      throw new SeedError(
        `目录外遗留权限行 ${stale.length} 条：${stale.map((row) => row.key).join(', ')} —— ` +
          '请人工确认后删除（删除会级联清理相关个人加授），seed 拒绝自动清库'
      )
    }

    // 3. role_permissions：先清空该角色（覆盖式收敛），再按 catalog 派生矩阵写回
    for (const role of ROLE_ORDER) {
      const keys = ROLE_PERMISSIONS[role]
      await tx`DELETE FROM role_permissions WHERE role = ${role}`
      if (keys.length === 0) continue

      const ids = keys.map((key) => {
        const id = idByKey.get(key)
        if (!id) throw new SeedError(`角色矩阵引用了 catalog 之外的 key：${role} → ${key}`)
        return id
      })

      await tx`
        INSERT INTO role_permissions (role, "permissionId")
        SELECT ${role}::varchar, unnest(${ids}::int[])
        ON CONFLICT (role, "permissionId") DO UPDATE SET role = EXCLUDED.role
      `
    }

    // 4. 写后自校验：行数不变量 + 未知角色一律拒绝
    const permissionCount = (await tx`SELECT count(*)::int AS count FROM permissions`)[0].count
    if (permissionCount !== PERMISSION_LIST.length) {
      throw new SeedError(
        `permissions 行数 ${permissionCount} != catalog 条目数 ${PERMISSION_LIST.length}`
      )
    }

    const rows = await tx`SELECT role, count(*)::int AS count FROM role_permissions GROUP BY role`
    const countByRole = new Map(rows.map((row) => [row.role, row.count]))
    for (const row of rows) {
      if (!ROLE_ORDER.includes(row.role)) {
        throw new SeedError(`role_permissions 存在未知角色行：${row.role}（请人工确认后处理）`)
      }
    }
    // 逐角色比对（含 USER=0：空角色也必须显式成立，不能靠「没出现在 GROUP BY 结果里」蒙混）
    for (const role of ROLE_ORDER) {
      const actual = countByRole.get(role) ?? 0
      if (actual !== expectedByRole[role]) {
        throw new SeedError(`角色 ${role} 行数 ${actual} != 派生矩阵 ${expectedByRole[role]}`)
      }
    }
  })

  return expectedByRole
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new SeedError('未设置 DATABASE_URL（读 .env 或环境变量）：拒绝静默跳过')
  }
  if (PERMISSION_LIST.length === 0) {
    throw new SeedError('catalog 为空：shared/rbac/permission-catalog.js 未导出任何权限')
  }

  const sql = postgres(databaseUrl, { max: 1 })
  try {
    log(`开始幂等写入（catalog ${PERMISSION_LIST.length} 项）…`)
    const expectedByRole = await writeSeed(sql)

    const counts = ROLE_ORDER.map((role) => expectedByRole[role]).join('/')
    log(`✔ permissions=${PERMISSION_LIST.length}；role_permissions：${ROLE_ORDER.map((role) => `${role}=${expectedByRole[role]}`).join(' ')}`)
    if (counts !== FROZEN_MATRIX_COUNTS) {
      log(
        `⚠ 矩阵计数 ${counts} 与 S1 冻结基线 ${FROZEN_MATRIX_COUNTS} 不一致 —— ` +
          '若为有意变更，请同步 tests/contract/permission-catalog.test.ts 与规划文档'
      )
    }
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(`[seed-permissions] ✖ ${error.message || error}`)
  process.exit(1)
})
