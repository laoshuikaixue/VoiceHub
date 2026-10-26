import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { eq } from 'drizzle-orm'
import { cardCodes, cardCodeRedeemLogs } from '~/drizzle/schema'
import { getServerDate } from '~~/server/utils/serverTime'
import {
  syncAssignmentOnManualStatusChange, assertCardCodesUnbound
} from '~~/server/services/cardCodeAssignmentService'
import { CARD_CODE_STATUSES } from '../../../card-codes/statuses'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '点歌券ID无效' })
  }

  const body = await readBody(event) ?? {}
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  const note = typeof body.note === 'string' ? body.note.trim() || null : undefined

  if (!status && note === undefined) {
    throw createError({ statusCode: 400, message: '没有需要更新的字段' })
  }

  try {
    const updated = await db.transaction(async (tx) => {
      if (status) await assertCardCodesUnbound(tx, [id])
      // 获取当前状态
      const rows = await tx.select().from(cardCodes).where(eq(cardCodes.id, id)).limit(1)
      const current = rows[0]
      if (!current) throw createError({ statusCode: 404, message: '点歌券未找到' })

      const now = getServerDate()
      const newValues: any = { updatedAt: now }

      if (status) {
        if (!CARD_CODE_STATUSES.includes(status as any)) {
          throw createError({ statusCode: 400, message: '不支持的状态值' })
        }
        if (status === 'REDEEMED') {
          newValues.status = 'REDEEMED'
          newValues.redeemedBy = user.id
          newValues.redeemedAt = now
          // 清理锁定信息
          newValues.lockedBy = null
          newValues.lockedAt = null
          // 手工改状态等于绕过派发流程，需解除持有人绑定
          newValues.assignedTo = null
          newValues.assignedAt = null
        } else if (status === 'AVAILABLE') {
          newValues.status = 'AVAILABLE'
          newValues.lockedBy = null
          newValues.lockedAt = null
          newValues.redeemedBy = null
          newValues.redeemedAt = null
          // 回到可用池即解除派发绑定
          newValues.assignedTo = null
          newValues.assignedAt = null
        } else if (status === 'LOCKED') {
          newValues.status = 'LOCKED'
          newValues.lockedBy = user.id
          newValues.lockedAt = now
          newValues.redeemedBy = null
          newValues.redeemedAt = null
          newValues.assignedTo = null
          newValues.assignedAt = null
        } else if (status === 'INVALID') {
          newValues.status = 'INVALID'
          // 作废时清理锁定与核销信息，与批量更新行为一致
          newValues.lockedBy = null
          newValues.lockedAt = null
          newValues.redeemedBy = null
          newValues.redeemedAt = null
          newValues.assignedTo = null
          newValues.assignedAt = null
        } else if (status === 'ASSIGNED') {
          // 手工置为已派发但没有持有人，与派发记录不一致，拒绝
          throw createError({
            statusCode: 400,
            message: '「已派发」状态需通过派发功能设置，请使用派发功能指定接收人'
          })
        }
      }

      if (note !== undefined) newValues.note = note

      const res = await tx.update(cardCodes).set(newValues).where(eq(cardCodes.id, id)).returning()
      const newRow = res[0]

      // 手工改状态绕过了派发流程，同步收敛活跃的派发记录，否则 ASSIGNED 记录会永久挂住
      if (status && status !== 'ASSIGNED') {
        await syncAssignmentOnManualStatusChange({
          tx,
          cardCodeIds: [id],
          status,
          actor: { id: user.id, name: user.name, username: user.username },
          reason: '管理员手工修改点歌券状态'
        })
      }

      if (status === 'REDEEMED' && current.status !== status) {
        await tx.insert(cardCodeRedeemLogs).values({
          cardCodeId: id,
          codeSnapshot: newRow.code,
          redeemedBy: user.id,
          redeemedAt: newRow.redeemedAt || now,
          source: 'ADMIN_MANUAL',
          songId: null
        })
      }

      return newRow
    })

    return { success: true, data: updated }
  } catch (err: any) {
    console.error('更新点歌券失败:', err)
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message || '更新失败' })
  }
})
