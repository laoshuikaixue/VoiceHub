/**
 * 一次性迁移：将历史已核销(REDEEMED)卡密，按 redeemedBy 用户补 +1 永久额度。
 * 幂等：按卡 id/idempotencyKey 幂等，可安全重跑。
 * 必须在应用 schema 迁移（删除 CardCode 表 / legacyCardId 列）之前运行。
 * 使用原生 SQL，不依赖当前 drizzle schema，避免 schema 已清理后无法运行。
 */
import 'dotenv/config'
import { createHash } from 'node:crypto'
import { client } from '../app/drizzle/db'

// 与 songQuotaService.fingerprintQuotaAdjustment 保持一致
const fingerprintQuotaAdjustment = ({ userId, delta }) =>
  createHash('sha256').update(JSON.stringify({ userId, delta })).digest('hex')

async function main() {
  console.log('开始迁移历史卡密 → 永久额度...')

  // 已核销、持有 redeemedBy 的卡
  const redeemedCards = await client`
    SELECT id, "redeemedBy" FROM "CardCode"
    WHERE status = 'REDEEMED' AND "redeemedBy" IS NOT NULL
  `

  console.log(`共 ${redeemedCards.length} 张 REDEEMED 卡需迁移`)

  let granted = 0
  let skipped = 0
  for (const card of redeemedCards) {
    const userId = Number(card.redeemedBy)
    const cardId = Number(card.id)
    const idempotencyKey = `legacy-card-migrate:${cardId}`

    // 幂等：已存在该 idempotencyKey 的流水则跳过
    const existing = await client`
      SELECT id FROM "SongQuotaTransaction" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
    `
    if (existing.length > 0) {
      skipped += 1
      continue
    }

    // 确保用户存在
    const user = await client`SELECT id FROM "User" WHERE id = ${userId} LIMIT 1`
    if (user.length === 0) {
      console.warn(`卡 ${cardId} 的 redeemedBy 用户 ${userId} 不存在，跳过`)
      skipped += 1
      continue
    }

    // 事务内：coalesce 取当前 permanentBalance，+1 后写回并记录流水
    await client.begin(async (tx) => {
      // 确保额度账户存在
      await tx`
        INSERT INTO "SongQuotaAccount" ("userId", "createdAt", "updatedAt")
        VALUES (${userId}, NOW(), NOW())
        ON CONFLICT ("userId") DO NOTHING
      `

      const account = await tx`
        SELECT * FROM "SongQuotaAccount" WHERE "userId" = ${userId} LIMIT 1 FOR UPDATE
      `
      const acc = account[0]
      const next = Number(acc.permanentBalance) + 1
      await tx`
        UPDATE "SongQuotaAccount" SET "permanentBalance" = ${next}, "updatedAt" = NOW()
        WHERE id = ${acc.id}
      `
      await tx`
        INSERT INTO "SongQuotaTransaction"
          ("accountId", "quotaType", "source", "delta", "balanceAfter",
           "idempotencyKey", "requestFingerprint", "legacyCardId", "createdAt")
        VALUES
          (${acc.id}, 'PERMANENT', 'LEGACY_CARD_CONVERT', 1, ${next},
           ${idempotencyKey}, ${fingerprintQuotaAdjustment({ userId, delta: 1 })}, ${cardId}, NOW())
      `
      granted += 1
    })
  }

  console.log(`迁移完成：入账 ${granted}，跳过 ${skipped}`)
  console.log('提示：确认无误后，再执行 schema 迁移删除卡密表。')
  await client.end({ timeout: 5 })
}

main().catch(async (err) => {
  console.error('迁移失败', err)
  await client.end({ timeout: 5 })
  process.exit(1)
})