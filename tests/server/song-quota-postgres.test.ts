import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../../app/drizzle/schema.ts'
import { runSongQuotaDrizzleTransaction } from '../../server/services/songQuotaDrizzleAdapter.ts'
import { adjustPermanentSongQuota, consumeSongQuota } from '../../server/services/songQuotaService.ts'

const databaseUrl = process.env.TEST_DATABASE_URL

test('点歌额度 PostgreSQL 相同幂等调整并发时仅变更一次余额', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 4 })
  const db = drizzle(sql, { schema })
  const suffix = `${process.pid}-${crypto.randomUUID()}`
  const [user] = await sql`
    INSERT INTO "User" (username, password, role, status, "createdAt", "updatedAt")
    VALUES (${`quota-idempotency-${suffix}`}, 'test-only', 'USER', 'active', NOW(), NOW())
    RETURNING id
  `

  try {
    const attempt = () => runSongQuotaDrizzleTransaction(db, (tx) => adjustPermanentSongQuota(tx, {
      userId: user.id,
      delta: 2,
      source: 'OPEN_API_ADJUST',
      now: new Date('2026-08-11T04:00:00.000Z'),
      idempotencyKey: `adjust-${suffix}`,
      requestFingerprint: `fingerprint-${suffix}`
    }))
    const results = await Promise.all([attempt(), attempt()])
    assert.equal(results[0].transaction.id, results[1].transaction.id)
    const [account] = await sql`
      SELECT "permanentBalance" FROM "SongQuotaAccount" WHERE "userId" = ${user.id}
    `
    assert.equal(account.permanentBalance, 2)
    const [count] = await sql`
      SELECT COUNT(*)::int AS value FROM "SongQuotaTransaction"
      WHERE "idempotencyKey" = ${`adjust-${suffix}`}
    `
    assert.equal(count.value, 1)
  } finally {
    await sql`DELETE FROM "User" WHERE id = ${user.id}`
    await sql.end()
  }
})

test('点歌额度 PostgreSQL 并发扣减仅成功一次', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 4 })
  const db = drizzle(sql, { schema })
  const suffix = `${process.pid}-${crypto.randomUUID()}`
  const [user] = await sql`
    INSERT INTO "User" (username, password, role, status, "createdAt", "updatedAt")
    VALUES (${`quota-${suffix}`}, 'test-only', 'USER', 'active', NOW(), NOW())
    RETURNING id
  `

  try {
    const [account] = await sql`
      INSERT INTO "SongQuotaAccount" (
        "userId", "periodicBalance", "permanentBalance", "periodKey", "createdAt", "updatedAt"
      ) VALUES (${user.id}, 1, 0, '2026-W33', NOW(), NOW())
      RETURNING id
    `
    const settings = {
      songQuotaEnabled: true,
      songQuotaPeriodType: 'WEEKLY',
      songQuotaPeriodAmount: 1,
      adminSongQuotaExempt: true,
      blockOnSongQuotaInsufficient: true
    }
    const attempt = (songId) => runSongQuotaDrizzleTransaction(db, (tx) => consumeSongQuota(tx, {
      userId: user.id,
      songId,
      requestId: crypto.randomUUID(),
      settings,
      now: new Date('2026-08-11T04:00:00.000Z'),
      isAdministrator: false
    }))
    const results = await Promise.allSettled([attempt(null), attempt(null)])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
    const [remaining] = await sql`SELECT "periodicBalance" FROM "SongQuotaAccount" WHERE id = ${account.id}`
    assert.equal(remaining.periodicBalance, 0)
  } finally {
    await sql`DELETE FROM "User" WHERE id = ${user.id}`
    await sql.end()
  }
})
