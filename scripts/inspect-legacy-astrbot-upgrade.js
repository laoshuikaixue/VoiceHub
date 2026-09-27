#!/usr/bin/env node
// 只读检查旧 AstrBot 数据库；不自动应用迁移。
import { config } from 'dotenv'
import postgres from 'postgres'
import { inspectLegacyAstrbotUpgrade, rejectSupersededAstrbotMigrations } from './astrbot-migration-guard.js'

config()
if (process.argv[2] !== '--inspect' || !process.env.DATABASE_URL || !process.env.ASTRBOT_UPGRADE_DATABASE) {
  console.error('需要 --inspect、DATABASE_URL 和 ASTRBOT_UPGRADE_DATABASE（数据库名）')
  process.exit(2)
}
const url = new URL(process.env.DATABASE_URL)
if (url.pathname.slice(1) !== process.env.ASTRBOT_UPGRADE_DATABASE) {
  console.error('目标数据库名与连接串不符；拒绝检查')
  process.exit(2)
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  const [migrationTable] = await sql`SELECT to_regclass('public.__drizzle_migrations__') AS table_name`
  if (!migrationTable?.table_name) throw new Error('迁移记录表不存在')
  const records = await sql`SELECT created_at, hash FROM public.__drizzle_migrations__`
  const applied = new Set(records.map((row) => BigInt(row.created_at)))
  const esaColumns = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'SystemSettings' AND column_name IN ('esaCaptchaPrefix', 'esaCaptchaScenes', 'esaCaptchaRegion')`
  const counts = await sql`SELECT (SELECT count(*)::int FROM "AstrbotBindingCode") AS codes,
    (SELECT count(*)::int FROM "AstrbotBinding") AS bindings,
    (SELECT count(*)::int FROM "AstrbotOutbox") AS outbox,
    (SELECT count(*)::int FROM "AstrbotOutbox" WHERE "deliveredAt" IS NULL AND "failedAt" IS NULL) AS pending`
  const claim = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'AstrbotOutbox' AND column_name = 'claimToken'`
  let stage = 'unknown'
  if (applied.has(1790435780014n)) {
    await rejectSupersededAstrbotMigrations(sql)
    stage = records.some((row) => BigInt(row.created_at) === 1790435780014n && row.hash === 'astrbot-legacy-bridge:v1')
      ? 'bridged' : 'combined'
  } else if (applied.has(1790340222774n)) {
    await inspectLegacyAstrbotUpgrade(sql)
    stage = 'esa-ready'
  } else {
    const old = [1790326842814n, 1790342504449n, 1790359178874n,
      1790380598636n, 1790381044650n, 1790396438534n, 1790402496386n]
    if (old.some((when) => !applied.has(when)) || esaColumns.length !== 0 || claim.length !== 0) {
      throw new Error('旧迁移链或 ESA/桥接结构不符合前置升级条件')
    }
    stage = 'esa-needed'
  }
  console.log(JSON.stringify({ stage, counts: counts[0], esaColumns: esaColumns.length, claimColumn: claim.length }))
} catch (error) {
  console.error(`只读预检失败：${error.message}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
