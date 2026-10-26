import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodeAssignments, cardCodes, users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
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

/** 把一名接收人本次成功派发的审计行汇总成一条通知 */
const toNotifyEntry = (target: AssignTarget, assigned: AssignOutcome[]) => ({
  target,
  assignmentIds: assigned.map((entry) => entry.assignmentId).filter((id): id is number => typeof id === 'number'),
  codes: assigned.map((entry) => entry.code).filter(Boolean)
})

/**
 * 派发单张点歌券给一个接收人。
 *
 * 状态流转与审计写入在同一事务内完成，保证「券为 ASSIGNED」与「存在活跃派发记录」始终一致；
 * 并发下用条件 UPDATE（仅 AVAILABLE 可派发）保证同一张券不会被派发两次。
 * 通知不在这里发，由 notifyAssignedRecipients 按接收人聚合发送。
 */
async function assignOneCard(params: {
  cardCodeId: number
  target: AssignTarget
  actor: AssignActor
  actorName: string
  targetName: string
  note?: string | null
}): Promise<AssignOutcome> {
  const { cardCodeId, target, actor, actorName, targetName, note } = params
  const now = getServerDate()

  try {
    return await db.transaction(async (tx) => {
      const locked = await tx
        .update(cardCodes)
        .set({ status: 'ASSIGNED', assignedTo: target.id, assignedAt: now, updatedAt: now })
        .where(and(eq(cardCodes.id, cardCodeId), eq(cardCodes.status, 'AVAILABLE')))
        .returning({ id: cardCodes.id, code: cardCodes.code })

      const row = locked[0]
      if (!row) {
        const current = await tx
          .select({ code: cardCodes.code, status: cardCodes.status })
          .from(cardCodes)
          .where(eq(cardCodes.id, cardCodeId))
          .limit(1)
        const existing = current[0]
        return {
          code: existing?.code || '',
          cardCodeId,
          assignmentId: null,
          success: false,
          reason: existing
            ? existing.status === 'ASSIGNED'
              ? '该点歌券已派发给其他用户，请先回收后再派发'
              : `该点歌券当前状态为 ${existing.status}，不可派发`
            : '点歌券不存在'
        } satisfies AssignOutcome
      }

      const assignmentRows = await tx
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

      return {
        code: row.code,
        cardCodeId: row.id,
        assignmentId: assignmentRows[0]?.id ?? null,
        success: true
      } satisfies AssignOutcome
    })
  } catch (error: any) {
    const reason = error?.message || '派发失败'
    console.error('派发点歌券失败:', error)

    // 事务已整体回滚（券状态与审计记录都未生效），这里只补一条 FAILED 流水
    let code = ''
    try {
      const [card] = await db
        .select({ code: cardCodes.code })
        .from(cardCodes)
        .where(eq(cardCodes.id, cardCodeId))
        .limit(1)
      code = card?.code || ''
      await db.insert(cardCodeAssignments).values({
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
    } catch (insertError) {
      console.error('记录点歌券派发失败日志出错:', insertError)
    }

    return { code, cardCodeId, assignmentId: null, success: false, reason }
  }
}

/**
 * 按接收人聚合发送派发通知：一次派发无论多少张券只发一条站内通知。
 *
 * 通知失败不回滚派发，结果写回该接收人本次所有审计行的 notifyStatus/notifyError，
 * 对应团购券「券已到账、消息未送达」的语义。
 */
async function notifyAssignedRecipients(
  entries: Array<{ target: AssignTarget; assignmentIds: number[]; codes: string[] }>,
  actor: AssignActor
): Promise<void> {
  for (const entry of entries) {
    if (!entry.assignmentIds.length || !entry.codes.length) continue

    let notifyStatus = NOTIFY_STATUS_SENT
    let notifyError: string | null = null
    const listed = entry.codes.slice(0, 5).join('、')
    const suffix = entry.codes.length > 5 ? ` 等 ${entry.codes.length} 张` : ''
    try {
      const result = await createSystemNotification(
        entry.target.id,
        '点歌券已发放',
        `管理员已为你发放 ${entry.codes.length} 张点歌券：${listed}${suffix}。投稿时可直接选择使用。`,
        false,
        { id: actor.id, name: actor.name, username: actor.username }
      )
      if (!result) {
        notifyStatus = NOTIFY_STATUS_FAILED
        notifyError = '接收人关闭了通知，站内通知未送达（点歌券已正常发放）'
      }
    } catch (error: any) {
      notifyStatus = NOTIFY_STATUS_FAILED
      notifyError = error?.message || '通知发送失败'
      console.error('派发点歌券通知发送失败:', error)
    }

    try {
      await db
        .update(cardCodeAssignments)
        .set({ notifyStatus, notifyError, updatedAt: getServerDate() })
        .where(inArray(cardCodeAssignments.id, entry.assignmentIds))
    } catch (error) {
      console.error('回写点歌券通知状态失败:', error)
    }
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
      await assignOneCard({ cardCodeId, target, actor, actorName, targetName, note })
    )
  }

  if (notify) {
    await notifyAssignedRecipients(
      [toNotifyEntry(target, outcomes.filter((outcome) => outcome.success))],
      actor
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
        note
      })
      if (outcome.success) {
        result.assigned.push(outcome)
      } else {
        result.failures.push(outcome)
      }
    }
  }

  if (notify) {
    await notifyAssignedRecipients(
      perUser
        .filter((item) => item.assigned.length)
        .map((item) => toNotifyEntry(item.target, item.assigned)),
      actor
    )
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

/** 生成券码并把生成器抛出的校验错误转为 400 */
function generateCardCodesOrThrow(options: Parameters<typeof generateCardCodes>[0]): string[] {
  try {
    return generateCardCodes(options)
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 400,
      message: error?.message || '生成点歌券失败'
    })
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
  const generatedCodes = generateCardCodesOrThrow({ count: totalCount, prefix })

  const created = await createCardCodes({ codes: generatedCodes, note: cardNote || null })
  const createdIds = created.map((row) => row.id)

  // 实际入库数少于预期（极小概率的券码碰撞）时按实际数量处理，多出的接收人记为未获得
  if (createdIds.length < totalCount) {
    console.warn(`生成点歌券时发生券码碰撞：期望 ${totalCount} 张，实际 ${createdIds.length} 张`)
  }

  // 逐人按固定偏移分配券码：一人失败不影响其他人的名额，也不会因游标顺移把错位的券发给别人
  const assignedIds = new Set<number>()
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]
    const result = perUserResult[index]
    if (!target || !result) continue
    const targetName = resolveDisplayName(target)
    const slice = createdIds.slice(index * perUser, index * perUser + perUser)

    if (slice.length < perUser) {
      result.failures.push({
        code: '',
        cardCodeId: null,
        assignmentId: null,
        success: false,
        reason: `点歌券生成数量不足（只生成 ${slice.length} 张），未能足额派发`
      })
    }

    for (const cardCodeId of slice) {
      const outcome = await assignOneCard({
        cardCodeId,
        target,
        actor,
        actorName,
        targetName,
        note
      })
      if (outcome.success) {
        result.assigned.push(outcome)
        assignedIds.add(cardCodeId)
      } else {
        result.failures.push(outcome)
      }
    }
  }

  // 本次生成但未成功派发出去的券（碰撞少生或单张失败）一律删除，不留莫名多出的库存券
  const leftoverIds = createdIds.filter((id) => !assignedIds.has(id))
  if (leftoverIds.length) {
    try {
      await deleteCardCodes(leftoverIds)
    } catch (error) {
      console.error('清理未派发的生成券失败:', error)
    }
  }

  if (notify) {
    await notifyAssignedRecipients(
      perUserResult
        .filter((item) => item.assigned.length)
        .map((item) => toNotifyEntry(item.target, item.assigned)),
      actor
    )
  }

  const skipped = perUserResult.filter((item) => item.assigned.length === 0).map((item) => item.target)
  const assignedCount = perUserResult.reduce((sum, item) => sum + item.assigned.length, 0)
  const failedCount = perUserResult.reduce((sum, item) => sum + item.failures.length, 0)

  return {
    perUser: perUserResult,
    skipped,
    // 只返回实际派发成功的券码，避免把已删除的残留券一起告知管理员
    generatedCodes: perUserResult.flatMap((item) => item.assigned.map((entry) => entry.code)),
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
 *
 * 券状态与审计记录在同一事务内更新，并校验影响行数：
 * 券已被投稿锁定或核销时整条回收失败，不出现「记录已回收、券没回池」的假成功。
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
  // 持有人 -> 被回收的券码，循环结束后按人聚合通知
  const recycledByHolder = new Map<number, string[]>()

  for (const assignmentId of assignmentIds) {
    try {
      const outcome = await db.transaction(async (tx): Promise<AssignOutcome & { holderId?: number | null }> => {
        const rows = await tx
          .select({
            id: cardCodeAssignments.id,
            cardCodeId: cardCodeAssignments.cardCodeId,
            codeSnapshot: cardCodeAssignments.codeSnapshot,
            status: cardCodeAssignments.status
          })
          .from(cardCodeAssignments)
          .where(eq(cardCodeAssignments.id, assignmentId))
          .limit(1)
          .for('update')

        const row = rows[0]
        if (!row) {
          return { code: '', cardCodeId: null, assignmentId, success: false, reason: '派发记录不存在' }
        }

        if (row.status !== 'ASSIGNED') {
          return {
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
          }
        }

        const now = getServerDate()
        let holderId: number | null = null

        // 仅回收仍处于 ASSIGNED 的券，并取回持有人用于通知
        if (row.cardCodeId) {
          const released = await tx
            .update(cardCodes)
            .set({ status: 'AVAILABLE', assignedTo: null, assignedAt: null, updatedAt: now })
            .where(and(eq(cardCodes.id, row.cardCodeId), eq(cardCodes.status, 'ASSIGNED')))
            .returning({ assignedTo: cardCodes.assignedTo })

          if (released.length === 0) {
            const [card] = await tx
              .select({ status: cardCodes.status })
              .from(cardCodes)
              .where(eq(cardCodes.id, row.cardCodeId))
              .limit(1)
            return {
              code: row.codeSnapshot,
              cardCodeId: row.cardCodeId,
              assignmentId,
              success: false,
              reason: card
                ? `该点歌券当前状态为 ${card.status}，已被投稿使用，无法回收`
                : '点歌券不存在，无法回收'
            }
          }
          holderId = released[0]?.assignedTo ?? null
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

        return {
          code: row.codeSnapshot,
          cardCodeId: row.cardCodeId,
          assignmentId,
          success: true,
          holderId
        }
      })

      outcomes.push(outcome)
      if (outcome.success && outcome.holderId && outcome.code) {
        const list = recycledByHolder.get(outcome.holderId) || []
        list.push(outcome.code)
        recycledByHolder.set(outcome.holderId, list)
      }
    } catch (error: any) {
      outcomes.push({
        code: '',
        cardCodeId: null,
        assignmentId,
        success: false,
        reason: error?.message || '回收失败'
      })
    }
  }

  // 回收后告知持有人，避免用户侧「券凭空消失」
  for (const [holderId, codes] of recycledByHolder) {
    const reasonText = reason ? `（原因：${reason}）` : ''
    try {
      await createSystemNotification(
        holderId,
        '点歌券已回收',
        `管理员已回收你的 ${codes.length} 张点歌券：${codes.slice(0, 5).join('、')}${codes.length > 5 ? ' 等' : ''}${reasonText}。`,
        false,
        { id: actor.id, name: actor.name, username: actor.username }
      )
    } catch (error) {
      console.error('回收点歌券通知发送失败:', error)
    }
  }

  return outcomes
}

/**
 * 管理员手工或开放 API 改券状态时，同步收敛活跃的派发记录。
 *
 * 这三条路径会解除持有人绑定，若不同步收敛，活跃 ASSIGNED 记录会永久挂住
 * （既挡住重新派发，也让回收列表出现幽灵记录）。
 */
export async function syncAssignmentOnManualStatusChange(params: {
  tx: any
  cardCodeIds: number[]
  status: string
  actor: AssignActor
  reason: string
}): Promise<void> {
  const { tx, cardCodeIds, status, actor, reason } = params
  if (!cardCodeIds.length) return
  if (!['AVAILABLE', 'LOCKED', 'INVALID', 'REDEEMED'].includes(status)) return

  const now = getServerDate()
  const changes =
    status === 'REDEEMED'
      ? { status: 'USED' as const, usedAt: now, updatedAt: now }
      : {
          status: 'RECYCLED' as const,
          recycledAt: now,
          recycledBy: actor.id,
          recycledByName: resolveDisplayName(actor),
          recycleReason: reason,
          updatedAt: now
        }

  await tx
    .update(cardCodeAssignments)
    .set(changes)
    .where(
      and(
        inArray(cardCodeAssignments.cardCodeId, cardCodeIds),
        eq(cardCodeAssignments.status, 'ASSIGNED')
      )
    )
}

/**
 * 点歌券被成功使用后，把派发记录置为 USED。
 * 在投稿提交事务中调用，保证「派发 → 使用」链路可追溯。
 */
export async function markCardCodeAssignmentUsed(
  tx: any,
  cardCodeId: number,
  usedAt: Date = getServerDate()
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
 * 投稿撤回或移出排期导致点歌券释放时，把派发记录恢复为 ASSIGNED，
 * 让用户下次投稿时仍可继续使用这张券。
 */
export async function restoreCardCodeAssignment(
  tx: any,
  cardCodeId: number,
  at: Date = getServerDate()
): Promise<void> {
  await tx
    .update(cardCodeAssignments)
    .set({ status: 'ASSIGNED', usedAt: null, recycledAt: null, updatedAt: at })
    .where(
      and(
        eq(cardCodeAssignments.cardCodeId, cardCodeId),
        inArray(cardCodeAssignments.status, ['USED', 'RECYCLED'])
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
