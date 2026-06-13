import { db } from '~/drizzle/db'
import { cardCodes, cardCodeRedeemLogs } from '~/drizzle/schema'
import { inArray, eq } from 'drizzle-orm'

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
      if (!['AVAILABLE', 'LOCKED', 'REDEEMED', 'INVALID'].includes(status)) {
        throw createError({ statusCode: 400, message: '不支持的状态值' })
      }
      updateObj.status = status
    }
    if (status === 'REDEEMED') {
      updateObj.redeemedBy = user.id
      updateObj.redeemedAt = new Date()
      updateObj.lockedBy = null
      updateObj.lockedAt = null
    }
    if (status === 'LOCKED') {
      updateObj.lockedBy = user.id
      updateObj.lockedAt = new Date()
      updateObj.redeemedBy = null
      updateObj.redeemedAt = null
    }
    if (status === 'AVAILABLE') {
      updateObj.lockedBy = null
      updateObj.lockedAt = null
      updateObj.redeemedBy = null
      updateObj.redeemedAt = null
    }
    if (typeof body.note !== 'undefined') {
      updateObj.note = typeof body.note === 'string' ? body.note.trim() || null : body.note
    }
    if (Object.keys(updateObj).length === 0) {
      throw createError({ statusCode: 400, message: '没有需要更新的字段' })
    }

    const res = await db.update(cardCodes).set(updateObj).where(inArray(cardCodes.id, normalizedIds)).returning()

    if (status === 'REDEEMED' && res.length > 0) {
      const logsToInsert = res
        .filter((row) => {
          const before = beforeMap.get(row.id)
          return before && before.status !== 'REDEEMED'
        })
        .map((row) => ({
          cardCodeId: row.id,
          codeSnapshot: row.code,
          redeemedBy: user.id,
          redeemedAt: row.redeemedAt || new Date(),
          source: 'ADMIN_MANUAL',
          songId: null
        }))

      if (logsToInsert.length > 0) {
        await db.insert(cardCodeRedeemLogs).values(logsToInsert)
      }
    }

    return { success: true, data: res }
  } catch (err: any) {
    console.error('更新点歌券失败', err)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || '更新点歌券失败' })
  }
})
