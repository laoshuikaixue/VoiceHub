import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodeAssignments, cardCodes, users } from '~/drizzle/schema'
import { createSystemNotification } from '~~/server/services/notificationService'
import {
  createCardCodes,
  deleteCardCodes,
  generateCardCodes
} from '~~/server/services/cardCodeGeneratorService'

/**
 * 点歌券派发服务。
 *
 * 交互模型参考美团/团购优惠券：
 * - 管理员把「未使用的点歌券」派发给指定用户，券即被该用户锁定持有（status=ASSIGNED）
 * - 用户投稿时可直接从下拉框选择自己持有的点歌券，也可手动输入券码
 * - 管理员可以回收尚未使用的已派发券，券回到 AVAILABLE 池中
 * - 每次派发/回收/使用都会落一条 CardCodeAssignment 记录，保留派发时间、派发人、接收人
 * - 通知发送失败不影响派发本身，失败原因记录在 notifyStatus/notifyError 字段中
 */

export type AssignActor = {
  id: number
  name?: string | null
  username?: string | null
}

export type AssignTarget = {
  id: number
  name?: string | null
  username?: string | null
}

export type AssignOutcome = {
  code: string
  cardCodeId: number | null
  assignmentId: number | null
  success: boolean
  /** 失败时的原因（已使用、已被派发、通知发送失败等） */
  reason?: string
  /** 通知是否发送成功 */
  notified?: boolean
}

/** 单个接收人的批量派发结果 */
export type UserAssignResult = {
  target: AssignTarget
  assigned: AssignOutcome[]
  failures: AssignOutcome[]
}

/** 多接收人派发结果（含券不足未获得任何券的接收人） */
export type BatchAssignResult = {
  perUser: UserAssignResult[]
  /** 券不够分，未获得任何点歌券的接收人 */
  skipped: AssignTarget[]
  summary: {
    recipients: number
    servedRecipients: number
    assignedCount: number
    failedCount: number
  }
}

const NOTIFY_STATUS_SENT = 'SENT'
const NOTIFY_STATUS_FAILED = 'FAILED'
const NOTIFY_STATUS_SKIPPED = 'SKIPPED'

/** 读取用户展示名，优先姓名其次用户名 */
const resolveDisplayName = (user: { name?: string | null; username?: string | null } | null | undefined) => {
  if (!user) return ''
  return (user.name || user.username || '').trim()
}

/**
 * 派发单张点歌券给一个接收人。
 *
 * 条件更新保证并发下同一张券不会被派发两次；
 * 通知发送失败不影响派发本身，失败原因记录在 notifyStatus/notifyError 字段中。
 */
async function assignOneCard(params: {
  cardCodeId: number
  target: AssignTarget
  actor: AssignActor
  actorName: string
  targetName: string
  note?: string | null
  notify: boolean
}): Promise<AssignOutcome> {
  const { cardCodeId, target, actor, actorName, targetName, note, notify } = params
  let assignmentId: number | null = null
  let code = ''
  try {
    // 条件更新保证并发下同一张券不会被派发两次
    const locked = await db
      .update(cardCodes)
      .set({
        status: 'ASSIGNED',
        assignedTo: target.id,
        assignedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, 'AVAILABLE')))
      .returning({ id: cardCodes.id, code: cardCodes.code })

    const row = locked[0]
    if (!row) {
      const current = await db
        .select({ code: cardCodes.code, status: cardCodes.status })
        .from(cardCodes)
        .where(eq(cardCodes.id, cardCodeId))
        .limit(1)
      const existing = current[0]
      code = existing?.code || ''
      return {
        code,
        cardCodeId,
        assignmentId: null,
        success: false,
        reason: existing
          ? existing.status === 'ASSIGNED'
            ? '该点歌券已派发给其他用户，请先回收后再派发'
            : `该点歌券当前状态为 ${existing.status}，不可派发`
          : '点歌券不存在'
      }
    }

    code = row.code

    const assignmentRows = await db
      .insert(cardCodeAssignments)
      .values({
        cardCodeId: row.id,
        codeSnapshot: row.code,
        userId: target.id,
        userNameSnapshot: targetName,
        assignedBy: actor.id,
        assignedByName: actorName,
        status: 'ASSIGNED',
        note: note || null
      })
      .returning({ id: cardCodeAssignments.id })
    assignmentId = assignmentRows[0]?.id ?? null

    // 通知失败不影响派发结果，仅记录下来供管理员查看
    let notified = false
    let notifyError: string | undefined
    if (notify) {
      try {
        const result = await createSystemNotification(
          target.id,
          '点歌券已发放',
          `管理员已为你发放一张点歌券，券码：${row.code}。投稿时可直接选择使用。`,
          false,
          { id: actor.id, name: actor.name, username: actor.username }
        )
        notified = Boolean(result)
        if (!result) {
          notifyError = '接收人关闭了通知，站内通知未送达（点歌券已正常发放）'
        }
      } catch (error: any) {
        notifyError = error?.message || '通知发送失败'
        console.error('派发点歌券通知发送失败:', error)
      }
    }

    await db
      .update(cardCodeAssignments)
      .set({
        notifyStatus: notify
          ? notified
            ? NOTIFY_STATUS_SENT
            : NOTIFY_STATUS_FAILED
          : NOTIFY_STATUS_SKIPPED,
        notifyError: notifyError || null,
        updatedAt: new Date()
      })
      .where(eq(cardCodeAssignments.id, assignmentId as number))

    return {
      code: row.code,
      cardCodeId: row.id,
      assignmentId,
      success: true,
      notified,
      reason: notifyError
    }
  } catch (error: any) {
    const reason = error?.message || '派发失败'
    console.error('派发点歌券失败:', error)

    // 落一条 FAILED 记录，保留失败时间与原因
    try {
      const failedRows = await db
        .insert(cardCodeAssignments)
        .values({
          cardCodeId,
          codeSnapshot: code,
          userId: target.id,
          userNameSnapshot: targetName,
          assignedBy: actor.id,
          assignedByName: actorName,
          status: 'FAILED',
          failureReason: reason,
          notifyStatus: NOTIFY_STATUS_SKIPPED,
          note: note || null
        })
        .returning({ id: cardCodeAssignments.id })
      assignmentId = failedRows[0]?.id ?? null
    } catch (insertError) {
      console.error('记录点歌券派发失败日志出错:', insertError)
    }

    // 券本身可能已被置为 ASSIGNED，回滚到 AVAILABLE 避免卡死
    try {
      await db
        .update(cardCodes)
        .set({ status: 'AVAILABLE', assignedTo: null, assignedAt: null, updatedAt: new Date() })
        .where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, 'ASSIGNED')))
    } catch (rollbackError) {
      console.error('回滚点歌券派发状态失败:', rollbackError)
    }

    return { code, cardCodeId, assignmentId, success: false, reason }
  }
}

/**
 * 把点歌券派发给指定用户。
 *
 * 每张券独立处理：单张失败（已被使用、已被他人派发、通知发送异常）不会中断整批，
 * 失败原因逐条返回给前端，便于管理员定位问题并重试。
 */
export async function assignCardCodesToUser(params: {
  cardCodeIds: number[]
  target: AssignTarget
  actor: AssignActor
  note?: string | null
  /** 是否给接收人发送站内通知 */
  notify?: boolean
}): Promise<AssignOutcome[]> {
  const { cardCodeIds, target, actor, note, notify = true } = params
  const outcomes: AssignOutcome[] = []
  if (!cardCodeIds.length) return outcomes

  const actorName = resolveDisplayName(actor)
  const targetName = resolveDisplayName(target)

  for (const cardCodeId of cardCodeIds) {
    outcomes.push(
      await assignOneCard({ cardCodeId, target, actor, actorName, targetName, note, notify })
    )
  }

  return outcomes
}

/**
 * 把一批点歌券轮流派发给多个接收人（发牌式分配）。
 *
 * 例如 5 张券、2 位接收人：第 1、3、5 张给第 1 人，第 2、4 张给第 2 人。
 * 接收人多于券时，排在后面的接收人不会获得券，会在 skipped 中列出，
 * 由前端明确提示，避免出现「静默漏发」。
 *
 * 每张券独立处理：单张失败不会中断整批，失败原因逐条记录。
 */
export async function assignCardCodesToUsers(params: {
  cardCodeIds: number[]
  targets: AssignTarget[]
  actor: AssignActor
  note?: string | null
  /** 是否给接收人发送站内通知 */
  notify?: boolean
}): Promise<BatchAssignResult> {
  const { cardCodeIds, targets, actor, note, notify = true } = params
  const perUser: UserAssignResult[] = targets.map((target) => ({
    target,
    assigned: [],
    failures: []
  }))
  if (!cardCodeIds.length || !targets.length) {
    return {
      perUser,
      skipped: targets.slice(),
      summary: {
        recipients: targets.length,
        servedRecipients: 0,
        assignedCount: 0,
        failedCount: 0
      }
    }
  }

  const actorName = resolveDisplayName(actor)
  const targetNames = new Map(targets.map((target) => [target.id, resolveDisplayName(target)]))

  // 轮流分配：第 i 张券给第 i % targets.length 个接收人
  const deals: Array<{ index: number; cardCodeId: number }> = []
  cardCodeIds.forEach((cardCodeId, index) => {
    deals.push({ index: index % targets.length, cardCodeId })
  })

  // 按接收人分组后逐人处理，通知与记录按人聚合，日志更直观
  const grouped = new Map<number, number[]>()
  for (const deal of deals) {
    const list = grouped.get(deal.index) || []
    list.push(deal.cardCodeId)
    grouped.set(deal.index, list)
  }

  for (const [index, ids] of grouped) {
    const target = targets[index]
    const result = perUser[index]
    if (!target || !result) continue
    const targetName = targetNames.get(target.id) || ''
    for (const cardCodeId of ids) {
      const outcome = await assignOneCard({
        cardCodeId,
        target,
        actor,
        actorName,
        targetName,
        note,
        notify
      })
      if (outcome.success) {
        result.assigned.push(outcome)
      } else {
        result.failures.push(outcome)
      }
    }
  }

  const skipped = perUser.filter((item) => item.assigned.length === 0).map((item) => item.target)
  const assignedCount = perUser.reduce((sum, item) => sum + item.assigned.length, 0)
  const failedCount = perUser.reduce((sum, item) => sum + item.failures.length, 0)

  return {
    perUser,
    skipped,
    summary: {
      recipients: targets.length,
      servedRecipients: perUser.length - skipped.length,
      assignedCount,
      failedCount
    }
  }
}

/**
 * 为每位接收人现场生成点歌券并直接派发。
 *
 * 与「先勾选库存券再派发」不同，这里按人数 × 每人张数即时生成新券，
 * 生成后逐张派发给对应用户，不需要管理员提前在列表里勾选。
 *
 * 每人获得的券数固定（不采用轮流分配），因此每位用户都不会被落下；
 * 若某位用户派发失败，仅该用户失败，其它用户不受影响。
 */
export async function generateAndAssignCardCodes(params: {
  targets: AssignTarget[]
  /** 每人派发的张数 */
  countPerUser: number
  actor: AssignActor
  note?: string | null
  /** 是否给接收人发送站内通知 */
  notify?: boolean
  /** 生成的券码前缀 */
  prefix?: string
  /** 生成的券码备注 */
  cardNote?: string | null
}): Promise<BatchAssignResult & { generatedCodes: string[] }> {
  const { targets, countPerUser, actor, note, notify = true, prefix, cardNote } = params

  const perUser = Number(countPerUser)
  if (!Number.isInteger(perUser) || perUser <= 0) {
    throw createError({ statusCode: 400, message: '每人派发张数必须为正整数' })
  }

  const perUserResult: UserAssignResult[] = targets.map((target) => ({
    target,
    assigned: [],
    failures: []
  }))

  if (!targets.length) {
    return {
      perUser: perUserResult,
      skipped: [],
      generatedCodes: [],
      summary: { recipients: 0, servedRecipients: 0, assignedCount: 0, failedCount: 0 }
    }
  }

  const totalCount = targets.length * perUser
  const actorName = resolveDisplayName(actor)

  // 先生成全部券码再入库，避免部分生成后才发现字符集不足
  let generatedCodes: string[] = []
  try {
    generatedCodes = generateCardCodes({ count: totalCount, prefix })
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 400,
      message: error?.message || '生成点歌券失败'
    })
  }

  const created = await createCardCodes({ codes: generatedCodes, note: cardNote || null })
  const createdIds = created.map((row) => row.id)

  // 实际入库数少于预期（极小概率的券码碰撞）时按实际数量处理，多出的接收人记为未获得
  if (createdIds.length < totalCount) {
    console.warn(`生成点歌券时发生券码碰撞：期望 ${totalCount} 张，实际 ${createdIds.length} 张`)
  }

  const actorNameForCard = actorName
  let cursor = 0
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]
    const result = perUserResult[index]
    if (!target || !result) continue
    const targetName = resolveDisplayName(target)

    for (let k = 0; k < perUser; k++) {
      const cardCodeId = createdIds[cursor]
      cursor += 1
      if (!cardCodeId) {
        result.failures.push({
          code: '',
          cardCodeId: null,
          assignmentId: null,
          success: false,
          reason: '点歌券生成数量不足，未能派发给该用户'
        })
        continue
      }
      const outcome = await assignOneCard({
        cardCodeId,
        target,
        actor,
        actorName: actorNameForCard,
        targetName,
        note,
        notify
      })
      if (outcome.success) {
        result.assigned.push(outcome)
      } else {
        result.failures.push(outcome)
      }
    }
  }

  // 券码碰撞导致部分券未派发出去时，把残留的可用券删除，避免管理员看到莫名多出的库存券
  const leftoverIds = createdIds.slice(cursor)
  if (leftoverIds.length) {
    try {
      await deleteCardCodes(leftoverIds)
    } catch (error) {
      console.error('清理未派发的生成券失败:', error)
    }
  }

  const skipped = perUserResult.filter((item) => item.assigned.length === 0).map((item) => item.target)
  const assignedCount = perUserResult.reduce((sum, item) => sum + item.assigned.length, 0)
  const failedCount = perUserResult.reduce((sum, item) => sum + item.failures.length, 0)

  return {
    perUser: perUserResult,
    skipped,
    generatedCodes: created.map((row) => row.code),
    summary: {
      recipients: targets.length,
      servedRecipients: perUserResult.length - skipped.length,
      assignedCount,
      failedCount
    }
  }
}

/**
 * 回收已派发但尚未使用的点歌券。
 * 回收后点歌券回到 AVAILABLE 池，可重新派发给其他用户。
 */
export async function recycleCardCodeAssignments(params: {
  assignmentIds: number[]
  actor: AssignActor
  reason?: string | null
}): Promise<AssignOutcome[]> {
  const { assignmentIds, actor, reason } = params
  const outcomes: AssignOutcome[] = []
  if (!assignmentIds.length) return outcomes

  const actorName = resolveDisplayName(actor)

  for (const assignmentId of assignmentIds) {
    const current = await db
      .select({
        id: cardCodeAssignments.id,
        cardCodeId: cardCodeAssignments.cardCodeId,
        codeSnapshot: cardCodeAssignments.codeSnapshot,
        status: cardCodeAssignments.status
      })
      .from(cardCodeAssignments)
      .where(eq(cardCodeAssignments.id, assignmentId))
      .limit(1)

    const row = current[0]
    if (!row) {
      outcomes.push({
        code: '',
        cardCodeId: null,
        assignmentId,
        success: false,
        reason: '派发记录不存在'
      })
      continue
    }

    if (row.status !== 'ASSIGNED') {
      outcomes.push({
        code: row.codeSnapshot,
        cardCodeId: row.cardCodeId,
        assignmentId,
        success: false,
        reason:
          row.status === 'USED'
            ? '该点歌券已被使用，无法回收'
            : row.status === 'RECYCLED'
              ? '该点歌券已回收，请勿重复操作'
              : '该派发记录当前状态不可回收'
      })
      continue
    }

    const now = new Date()
    try {
      await db.transaction(async (tx) => {
        // 仅回收仍处于 ASSIGNED 的券；已被用户锁走（LOCKED）或核销（REDEEMED）则不动
        if (row.cardCodeId) {
          await tx
            .update(cardCodes)
            .set({ status: 'AVAILABLE', assignedTo: null, assignedAt: null, updatedAt: now })
            .where(and(eq(cardCodes.id, row.cardCodeId), eq(cardCodes.status, 'ASSIGNED')))
        }

        await tx
          .update(cardCodeAssignments)
          .set({
            status: 'RECYCLED',
            recycledAt: now,
            recycledBy: actor.id,
            recycledByName: actorName,
            recycleReason: reason || null,
            updatedAt: now
          })
          .where(and(eq(cardCodeAssignments.id, assignmentId), eq(cardCodeAssignments.status, 'ASSIGNED')))
      })

      outcomes.push({
        code: row.codeSnapshot,
        cardCodeId: row.cardCodeId,
        assignmentId,
        success: true
      })
    } catch (error: any) {
      outcomes.push({
        code: row.codeSnapshot,
        cardCodeId: row.cardCodeId,
        assignmentId,
        success: false,
        reason: error?.message || '回收失败'
      })
    }
  }

  return outcomes
}

/**
 * 点歌券被成功使用后，把派发记录置为 USED。
 * 在投稿提交事务中调用，保证「派发 → 使用」链路可追溯。
 */
export async function markCardCodeAssignmentUsed(
  tx: any,
  cardCodeId: number,
  usedAt: Date = new Date()
): Promise<void> {
  await tx
    .update(cardCodeAssignments)
    .set({ status: 'USED', usedAt, updatedAt: usedAt })
    .where(
      and(
        eq(cardCodeAssignments.cardCodeId, cardCodeId),
        eq(cardCodeAssignments.status, 'ASSIGNED')
      )
    )
}

/**
 * 撤回投稿导致点歌券被释放时，把派发记录恢复为 ASSIGNED，
 * 让用户下次投稿时仍可继续使用这张券。
 */
export async function restoreCardCodeAssignment(
  tx: any,
  cardCodeId: number,
  at: Date = new Date()
): Promise<void> {
  await tx
    .update(cardCodeAssignments)
    .set({ status: 'ASSIGNED', usedAt: null, updatedAt: at })
    .where(
      and(
        eq(cardCodeAssignments.cardCodeId, cardCodeId),
        eq(cardCodeAssignments.status, 'USED')
      )
    )
}

/**
 * 查询某用户当前持有的可用点歌券（status=ASSIGNED 的券）。
 * 供用户端下拉框展示。
 */
export async function listUserAssignedCardCodes(userId: number) {
  return db
    .select({
      id: cardCodes.id,
      code: cardCodes.code,
      assignedAt: cardCodes.assignedAt,
      note: cardCodes.note,
      assignmentId: cardCodeAssignments.id,
      assignedByName: cardCodeAssignments.assignedByName,
      notifyStatus: cardCodeAssignments.notifyStatus
    })
    .from(cardCodes)
    .innerJoin(
      cardCodeAssignments,
      and(
        eq(cardCodeAssignments.cardCodeId, cardCodes.id),
        eq(cardCodeAssignments.status, 'ASSIGNED')
      )
    )
    .where(and(eq(cardCodes.assignedTo, userId), eq(cardCodes.status, 'ASSIGNED')))
    .orderBy(sql`${cardCodes.assignedAt} desc nulls last`)
}
