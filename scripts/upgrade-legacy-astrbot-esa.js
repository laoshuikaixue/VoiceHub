#!/usr/bin/env node
// 旧 AstrBot 库只补执行已生成的上游 ESA 迁移；不触发后续合并建表迁移。
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import postgres from 'postgres'
import { inspectLegacyAstrbotUpgrade, inspectLegacyAstrbotSchema } from './astrbot-migration-guard.js'

config()
if (process.argv[2] !== '--apply' || !process.env.DATABASE_URL || !process.env.ASTRBOT_UPGRADE_DATABASE) {
  console.error('需要 --apply、DATABASE_URL 和 ASTRBOT_UPGRADE_DATABASE（数据库名）')
  process.exit(2)
}
const url = new URL(process.env.DATABASE_URL)
if (url.pathname.slice(1) !== process.env.ASTRBOT_UPGRADE_DATABASE) {
  console.error('目标数据库名与连接串不符；拒绝执行')
  process.exit(2)
}
const migrationUrl = new URL('../app/drizzle/migrations/20260925124342_add_aliyun_esa_captcha.sql', import.meta.url)
const source = readFileSync(fileURLToPath(migrationUrl), 'utf8')
const migrationHash = createHash('sha256').update(source).digest('hex')
if (migrationHash !== '331608ac93e5e74be0a8db9b9fb19fcc176458bf718e9859f3003964abd558df') {
  console.error('上游 ESA 迁移文件摘要不匹配；拒绝执行')
  process.exit(2)
}
const statements = source.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)
const expectedColumns = ['esaCaptchaPrefix', 'esaCaptchaScenes', 'esaCaptchaRegion']
if (statements.length !== 3 || statements.some((part, index) => !part.startsWith(`ALTER TABLE "SystemSettings" ADD COLUMN "${expectedColumns[index]}" `))) {
  console.error('ESA 迁移文件内容与预期不符；拒绝执行')
  process.exit(2)
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(1790340222774)`
    const [table] = await tx`SELECT to_regclass('public.__drizzle_migrations__') AS table_name`
    if (!table?.table_name) throw new Error('迁移记录表不存在')
    const records = await tx`SELECT created_at FROM public.__drizzle_migrations__`
    const applied = new Set(records.map((row) => BigInt(row.created_at)))
    if (applied.has(1790340222774n) || applied.has(1790435780014n)) throw new Error('ESA 或合并迁移已登记；拒绝重复执行')
    const legacy = [1790326842814n, 1790342504449n, 1790359178874n,
      1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n]
    if (legacy.some((when) => !applied.has(when))) throw new Error('旧版 AstrBot 迁移链不完整')
    const tables = await tx`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('AstrbotBindingCode', 'AstrbotBinding', 'AstrbotOutbox')`
    if (tables.length !== 3) throw new Error('旧版 AstrBot 表不完整')
    const columns = await tx`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'SystemSettings' AND column_name IN ('esaCaptchaPrefix', 'esaCaptchaScenes', 'esaCaptchaRegion')`
    if (columns.length) throw new Error('ESA 列已存在或部分存在，拒绝重放')
    await inspectLegacyAstrbotSchema(tx)
    for (const statement of statements) await tx.unsafe(statement)
    await tx`INSERT INTO public.__drizzle_migrations__ (hash, created_at) VALUES (${migrationHash}, ${1790340222774})`
    // 此时预检应通过，但正式桥接仍须由单独脚本执行。
    await inspectLegacyAstrbotUpgrade(tx)
  })
  console.log('上游 ESA 迁移完成；尚未执行 AstrBot 桥接')
} catch (error) {
  console.error(`ESA 前置升级失败（事务已回滚）：${error.message}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
