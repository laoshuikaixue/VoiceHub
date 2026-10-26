import { getServerDate } from '~~/server/utils/serverTime'
import { db } from '~/drizzle/db'
import { cardCodes, cardCodeRedeemLogs } from '~/drizzle/schema'
import { inArray, eq } from 'drizzle-orm'
import { syncAssignmentOnManualStatusChange, assertCardCodesUnbound } from '~~/server/services/cardCodeAssignmentService'
import { CARD_CODE_STATUSES } from '../../../card-codes/statuses'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const body = await readBody(event) ?? {}
  const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  if (!ids.length) {
    throw createError({ statusCode: 400, message: '缺少点歌券ID' })
  }

  try {
    const normalizedIds = ids.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
    if (!normalizedIds.length) {
      throw createError({ statusCode: 400, message: '点歌券ID无效' })
    }

    const beforeRows = await db
      .select({
        id: cardCodes.id,
        code: cardCodes.code,
        status: cardCodes.status
      })
      .from(cardCodes)
      .where(inArray(cardCodes.id, normalizedIds))

    const beforeMap = new Map(beforeRows.map((row) => [row.id, row]))

    const updateObj: any = {}
    if (status) {
      if (!CARD_CODE_STATUSES.includes(status as any)) {
        throw createError({ statusCode: 400, message: '不支持的状态值' })
      }
      if (status === 'ASSIGNED') {
        // 手工置为已派发但没有持有人，与派发记录不一致，拒绝
        throw createError({
          statusCode: 400,
          message: '「已派发」状态需通过派发功能设置，请使用派发功能指定接收人'
        })
      }
      updateObj.status = status
    }
    if (status === 'REDEEMED') {
      updateObj.redeemedBy = user.id
      updateObj.redeemedAt = getServerDate()
      updateObj.lockedBy = null
      updateObj.lockedAt = null
      updateObj.assignedTo = null
      updateObj.assignedAt = null
    }
    if (status === 'LOCKED') {
      updateObj.lockedBy = user.id
      updateObj.lockedAt = getServerDate()
      updateObj.redeemedBy = null
      updateObj.redeemedAt = null
      updateObj.assignedTo = null
      updateObj.assignedAt = null
    }
    if (status === 'AVAILABLE') {
      updateObj.lockedBy = null
      updateObj.lockedAt = null
      updateObj.redeemedBy = null
      updateObj.redeemedAt = null
      updateObj.assignedTo = null
      updateObj.assignedAt = null
    }
    if (status === 'INVALID') {
      updateObj.lockedBy = null
      updateObj.lockedAt = null
      updateObj.redeemedBy = null
      updateObj.redeemedAt = null
      updateObj.assignedTo = null
      updateObj.assignedAt = null
    }
    if (typeof body.note !== 'undefined') {
      updateObj.note = typeof body.note === 'string' ? body.note.trim() || null : body.note
    }
    if (Object.keys(updateObj).length === 0) {
      throw createError({ statusCode: 400, message: '没有需要更新的字段' })
    }
    updateObj.updatedAt = getServerDate()

    const res = await db.transaction(async (tx) => {
      if (status) await assertCardCodesUnbound(tx, normalizedIds)
      const updatedRows = await tx.update(cardCodes).set(updateObj).where(inArray(cardCodes.id, normalizedIds)).returning()

      // 批量改状态同样要收敛活跃的派发记录，避免券已解绑、ASSIGNED 记录还挂着
      if (status && updatedRows.length > 0) {
        await syncAssignmentOnManualStatusChange({
          tx,
          cardCodeIds: updatedRows.map((row) => row.id),
          status,
          actor: { id: user.id, name: user.name, username: user.username },
          reason: '管理员批量修改点歌券状态'
        })
      }

      if (status === 'REDEEMED' && updatedRows.length > 0) {
        const logsToInsert = updatedRows
          .filter((row) => {
            const before = beforeMap.get(row.id)
            return before && before.status !== status
          })
          .map((row) => ({
            cardCodeId: row.id,
            codeSnapshot: row.code,
            redeemedBy: user.id,
            redeemedAt: row.redeemedAt || getServerDate(),
            source: 'ADMIN_MANUAL',
            songId: null
          }))

        if (logsToInsert.length > 0) {
          await tx.insert(cardCodeRedeemLogs).values(logsToInsert)
        }
      }

      return updatedRows
    })

    return { success: true, data: res }
  } catch (err: any) {
    console.error('更新点歌券失败', err)
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message || '更新点歌券失败' })
  }
})
