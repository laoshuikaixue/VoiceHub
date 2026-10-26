import { and, eq } from 'drizzle-orm'
import { cardCodeAssignments, cardCodes, users } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'

type RestoreMappings = {
  users: Map<number, number>
  cardCodes: Map<number, number>
}

const sameTime = (left: Date | null, right: Date | null) =>
  left != null && right != null && left.getTime() === right.getTime()

/** 恢复持有券时同步建立当前派发记录。 */
export async function syncRestoredCardCodeAssignment(tx: any, card: any) {
  const now = getServerDate()
  const currentStatus = card.assignedTo == null
    ? null
    : card.status === 'REDEEMED'
      ? 'USED'
      : ['ASSIGNED', 'LOCKED'].includes(card.status)
        ? 'ASSIGNED'
        : null
  const records = await tx.select().from(cardCodeAssignments)
    .where(eq(cardCodeAssignments.cardCodeId, card.id)).for('update')
  const assignedAt = card.assignedAt || now
  const current = currentStatus
    ? records.find((entry: any) => entry.userId === card.assignedTo && sameTime(entry.assignedAt, assignedAt))
      || records.find((entry: any) => entry.userId === card.assignedTo && entry.status === 'ASSIGNED')
    : null

  for (const entry of records) {
    if (entry.status !== 'ASSIGNED' || entry.id === current?.id) continue
    await tx.update(cardCodeAssignments).set({
      status: 'RECYCLED', recycledAt: now, recycleReason: '备份恢复调整持有人', updatedAt: now
    }).where(eq(cardCodeAssignments.id, entry.id))
  }
  if (!currentStatus) return
  if (current) {
    await tx.update(cardCodeAssignments).set({
      status: currentStatus, usedAt: currentStatus === 'USED' ? card.redeemedAt || now : null,
      updatedAt: now
    }).where(eq(cardCodeAssignments.id, current.id))
    return
  }
  const [holder] = await tx.select({ name: users.name, username: users.username })
    .from(users).where(eq(users.id, card.assignedTo)).limit(1)
  await tx.insert(cardCodeAssignments).values({
    cardCodeId: card.id, codeSnapshot: card.code, userId: card.assignedTo,
    userNameSnapshot: holder?.name || holder?.username || null, assignedAt,
    status: currentStatus, usedAt: currentStatus === 'USED' ? card.redeemedAt || now : null,
    note: '备份恢复持有记录'
  })
}

/** 按恢复后的用户与券映射导入派发流水。 */
export async function restoreCardCodeAssignmentRecord(
  tx: any, record: any, mode: string, mappings: RestoreMappings
): Promise<'created' | 'updated' | 'skipped'> {
  if (!record.codeSnapshot) return 'skipped'
  const mapUser = async (value: unknown) => {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) return null
    const mapped = mappings.users.get(id)
    if (mapped) return mapped
    if (mode === 'merge') return null
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
    return existing?.id ?? null
  }
  const rawCardId = Number(record.cardCodeId)
  const mappedCardId = mappings.cardCodes.get(rawCardId) || (mode === 'merge' ? null : rawCardId)
  const [card] = mappedCardId
    ? await tx.select().from(cardCodes).where(eq(cardCodes.id, mappedCardId)).limit(1).for('update')
    : []
  const now = getServerDate()
  const assignedAt = record.assignedAt ? new Date(record.assignedAt) : now
  const userId = await mapUser(record.userId)
  let status = record.status || 'ASSIGNED'
  const isHolder = card && card.assignedTo != null && card.assignedTo === userId
  if (status === 'ASSIGNED' && isHolder) {
    status = card.status === 'REDEEMED' ? 'USED' : ['ASSIGNED', 'LOCKED'].includes(card.status) ? 'ASSIGNED' : 'RECYCLED'
  } else if (status === 'ASSIGNED') {
    status = 'RECYCLED'
  }
  const data: any = {
    cardCodeId: card?.id ?? null, codeSnapshot: record.codeSnapshot, userId,
    userNameSnapshot: record.userNameSnapshot,
    assignedBy: await mapUser(record.assignedBy), assignedByName: record.assignedByName,
    createdAt: record.createdAt ? new Date(record.createdAt) : now,
    updatedAt: record.updatedAt ? new Date(record.updatedAt) : now,
    assignedAt, status, usedAt: record.usedAt ? new Date(record.usedAt) : status === 'USED' ? card?.redeemedAt || now : null,
    recycledAt: record.recycledAt ? new Date(record.recycledAt) : status === 'RECYCLED' ? now : null,
    recycledBy: await mapUser(record.recycledBy), recycledByName: record.recycledByName,
    recycleReason: record.recycleReason, failureReason: record.failureReason,
    notifyStatus: record.notifyStatus || 'SKIPPED', notifyError: record.notifyError, note: record.note
  }
  const candidates = mode === 'merge'
    ? card && userId
      ? await tx.select().from(cardCodeAssignments)
        .where(and(eq(cardCodeAssignments.cardCodeId, card.id), eq(cardCodeAssignments.userId, userId)))
      : []
    : await tx.select().from(cardCodeAssignments).where(eq(cardCodeAssignments.id, record.id)).limit(1)
  const existing = mode === 'merge'
    ? candidates.find((entry: any) => sameTime(entry.assignedAt, assignedAt))
      || (record.status === 'ASSIGNED' && isHolder
        ? candidates.find((entry: any) => entry.status === status)
        : candidates.find((entry: any) => entry.note === '备份恢复持有记录' && entry.status === status))
    : candidates[0]
  if (existing) {
    await tx.update(cardCodeAssignments).set(data).where(eq(cardCodeAssignments.id, existing.id))
    return 'updated'
  }
  if (mode !== 'merge' && record.id) data.id = record.id
  await tx.insert(cardCodeAssignments).values(data)
  return 'created'
}
