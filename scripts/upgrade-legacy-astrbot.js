#!/usr/bin/env node
// 仅限已完整执行旧 AstrBot 迁移链的库；先在离线副本演练，再于停写窗口运行。
import { config } from 'dotenv'
import postgres from 'postgres'
import { inspectLegacyAstrbotUpgrade, inspectLegacyAstrbotSchema, ASTRBOT_LEGACY_BRIDGE_HASH } from './astrbot-migration-guard.js'

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
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  const result = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(1790435780014)`
    await inspectLegacyAstrbotUpgrade(tx)
    await inspectLegacyAstrbotSchema(tx)
    const countsBefore = await tx`SELECT
      (SELECT count(*)::int FROM "AstrbotBindingCode") AS codes,
      (SELECT count(*)::int FROM "AstrbotBinding") AS bindings,
      (SELECT count(*)::int FROM "AstrbotOutbox") AS outbox`
    await tx`ALTER TABLE "AstrbotOutbox" ADD COLUMN "claimToken" text`
    await tx`ALTER TABLE "AstrbotBinding" ALTER COLUMN "boundAt" SET DEFAULT now(), ALTER COLUMN "boundAt" SET NOT NULL`
    const after = await tx`SELECT
      (SELECT count(*)::int FROM "AstrbotBindingCode") AS codes,
      (SELECT count(*)::int FROM "AstrbotBinding") AS bindings,
      (SELECT count(*)::int FROM "AstrbotOutbox") AS outbox`
    if (JSON.stringify(countsBefore[0]) !== JSON.stringify(after[0])) throw new Error('桥接前后行数变化')
    await tx`INSERT INTO public.__drizzle_migrations__ (hash, created_at)
      VALUES (${ASTRBOT_LEGACY_BRIDGE_HASH}, ${1790435780014})`
    return after[0]
  })
  console.log('桥接完成，三表行数未变：', JSON.stringify(result))
} catch (error) {
  console.error(`受控升级失败（事务已回滚）：${error.message}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
