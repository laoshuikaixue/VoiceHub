/**
 * 点歌券派发链路端到端校验（直接对数据库操作，验证状态机与派发记录）。
 * 用法：node scripts/test-card-code-assignment.mjs
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('缺少 DATABASE_URL')
  process.exit(1)
}
const sql = postgres(url, { max: 1, connect_timeout: 8 })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const run = async () => {
  // 准备两个测试用户
  const stamp = Date.now()
  const [admin] = await sql`
    INSERT INTO "User" (username, name, role, password, "createdAt", "updatedAt")
    VALUES (${`cc_admin_${stamp}`}, 'CC测试管理员', 'SUPER_ADMIN', 'x', now(), now())
    RETURNING id, name, username
  `
  const [userA] = await sql`
    INSERT INTO "User" (username, name, role, password, "createdAt", "updatedAt")
    VALUES (${`cc_user_a_${stamp}`}, 'CC测试甲', 'USER', 'x', now(), now())
    RETURNING id, name, username
  `
  const [userB] = await sql`
    INSERT INTO "User" (username, name, role, password, "createdAt", "updatedAt")
    VALUES (${`cc_user_b_${stamp}`}, 'CC测试乙', 'USER', 'x', now(), now())
    RETURNING id, name, username
  `

  // 准备三张可用点歌券
  const codes = await sql`
    INSERT INTO "CardCode" (code, status, note, "createdAt", "updatedAt")
    VALUES
      (${`CC-TEST-A-${stamp}`}, 'AVAILABLE', 'test', now(), now()),
      (${`CC-TEST-B-${stamp}`}, 'AVAILABLE', 'test', now(), now()),
      (${`CC-TEST-C-${stamp}`}, 'AVAILABLE', 'test', now(), now())
    RETURNING id, code
  `

  const assign = async (cardCodeId, userId, assignedBy) => {
    const res = await sql`
      UPDATE "CardCode"
      SET status = 'ASSIGNED', "assignedTo" = ${userId}, "assignedAt" = now(), "updatedAt" = now()
      WHERE id = ${cardCodeId} AND status = 'AVAILABLE'
      RETURNING id, code, status, "assignedTo"
    `
    if (!res[0]) return { ok: false }
    const [assignment] = await sql`
      INSERT INTO "CardCodeAssignment"
        ("cardCodeId", "codeSnapshot", "userId", "userNameSnapshot", "assignedBy", "assignedByName", status, "assignedAt", "notifyStatus", "createdAt", "updatedAt")
      VALUES
        (${res[0].id}, ${res[0].code}, ${userId}, 'CC测试甲', ${assignedBy}, 'CC测试管理员', 'ASSIGNED', now(), 'SENT', now(), now())
      RETURNING id
    `
    return { ok: true, card: res[0], assignmentId: assignment.id }
  }

  // 1. 派发给甲
  const a1 = await assign(codes[0].id, userA.id, admin.id)
  check('派发后券状态变为 ASSIGNED', a1.ok && a1.card.status === 'ASSIGNED', `status=${a1.card?.status}`)
  check('派发后写入持有人 assignedTo', a1.ok && a1.card.assignedTo === userA.id, `assignedTo=${a1.card?.assignedTo}`)
  check('派发记录落库且记录派发人与时间', !!a1.assignmentId)

  // 2. 同一张券不能被再次派发
  const dup = await assign(codes[0].id, userB.id, admin.id)
  check('已派发的券无法再次派发', !dup.ok, '第二次派发被拒绝')

  // 3. 派发记录包含派发时间/人员/接收人
  const [rec] = await sql`
    SELECT "userId", "assignedBy", "assignedByName", "assignedAt", status
    FROM "CardCodeAssignment" WHERE id = ${a1.assignmentId}
  `
  check(
    '派发记录含派发时间、派发人员、接收人',
    rec.userId === userA.id && rec.assignedBy === admin.id && !!rec.assignedAt && rec.status === 'ASSIGNED',
    `userId=${rec.userId} assignedBy=${rec.assignedBy} assignedAt=${rec.assignedAt}`
  )

  // 4. 甲持有的券出现在「我的点歌券」查询里
  const mine = await sql`
    SELECT c.id, c.code FROM "CardCode" c
    INNER JOIN "CardCodeAssignment" a ON a."cardCodeId" = c.id AND a.status = 'ASSIGNED'
    WHERE c."assignedTo" = ${userA.id} AND c.status = 'ASSIGNED'
  `
  check('用户可查询到自己的已派发券', mine.length === 1 && mine[0].id === codes[0].id, `count=${mine.length}`)

  // 5. 乙不应看到甲的券
  const mineB = await sql`
    SELECT c.id FROM "CardCode" c
    INNER JOIN "CardCodeAssignment" a ON a."cardCodeId" = c.id AND a.status = 'ASSIGNED'
    WHERE c."assignedTo" = ${userB.id} AND c.status = 'ASSIGNED'
  `
  check('他人无法查询到该券', mineB.length === 0, `count=${mineB.length}`)

  // 6. 模拟使用：锁定 → 核销，并更新派发记录为 USED
  const lock = await sql`
    UPDATE "CardCode" SET status = 'LOCKED', "lockedBy" = ${userA.id}, "lockedAt" = now(), "updatedAt" = now()
    WHERE id = ${codes[0].id} AND status = 'ASSIGNED' AND "assignedTo" = ${userA.id}
    RETURNING id
  `
  check('持有人可锁定自己的券', lock.length === 1)

  const lockByOther = await sql`
    UPDATE "CardCode" SET status = 'LOCKED', "lockedBy" = ${userB.id}, "lockedAt" = now()
    WHERE id = ${codes[0].id} AND status = 'ASSIGNED' AND "assignedTo" = ${userB.id}
    RETURNING id
  `
  check('他人无法锁定该券', lockByOther.length === 0)

  await sql`UPDATE "CardCodeAssignment" SET status = 'USED', "usedAt" = now() WHERE id = ${a1.assignmentId}`
  const [usedRec] = await sql`SELECT status, "usedAt" FROM "CardCodeAssignment" WHERE id = ${a1.assignmentId}`
  check('使用后派发记录变为 USED', usedRec.status === 'USED' && !!usedRec.usedAt)

  // 7. 回收：仅未使用的券可回收
  const a2 = await assign(codes[1].id, userA.id, admin.id)
  const recycled = await sql`
    UPDATE "CardCode" SET status = 'AVAILABLE', "assignedTo" = NULL, "assignedAt" = NULL, "updatedAt" = now()
    WHERE id = ${codes[1].id} AND status = 'ASSIGNED'
    RETURNING id
  `
  await sql`
    UPDATE "CardCodeAssignment" SET status = 'RECYCLED', "recycledAt" = now(), "recycledBy" = ${admin.id}, "recycleReason" = 'test'
    WHERE id = ${a2.assignmentId}
  `
  check('回收后券回到 AVAILABLE', recycled.length === 1)

  const [afterRecycle] = await sql`SELECT status, "assignedTo" FROM "CardCode" WHERE id = ${codes[1].id}`
  check('回收后清除持有人', afterRecycle.status === 'AVAILABLE' && afterRecycle.assignedTo === null)

  const [recycleRec] = await sql`SELECT status, "recycledAt", "recycledBy" FROM "CardCodeAssignment" WHERE id = ${a2.assignmentId}`
  check('回收记录含回收时间与回收人', recycleRec.status === 'RECYCLED' && !!recycleRec.recycledAt && recycleRec.recycledBy === admin.id)

  // 8. 已使用的券不能回收
  const a3 = await assign(codes[2].id, userA.id, admin.id)
  await sql`UPDATE "CardCode" SET status = 'REDEEMED', "redeemedBy" = ${userA.id}, "redeemedAt" = now() WHERE id = ${codes[2].id}`
  const recycleUsed = await sql`
    UPDATE "CardCode" SET status = 'AVAILABLE' WHERE id = ${codes[2].id} AND status = 'ASSIGNED' RETURNING id
  `
  check('已核销的券无法回收', recycleUsed.length === 0)
  void a3

  // 清理
  await sql`DELETE FROM "CardCodeAssignment" WHERE "cardCodeId" IN ${sql(codes.map((c) => c.id))}`
  await sql`DELETE FROM "CardCode" WHERE id IN ${sql(codes.map((c) => c.id))}`
  await sql`DELETE FROM "User" WHERE id IN ${sql([admin.id, userA.id, userB.id])}`

  await sql.end()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    console.log('失败项：', failed.map((f) => f.name).join('、'))
    process.exit(1)
  }
}

run().catch(async (err) => {
  console.error('测试异常:', err)
  await sql.end()
  process.exit(1)
})
