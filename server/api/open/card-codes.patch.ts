import { db } from '~/drizzle/db'
import { cardCodes, cardCodeRedeemLogs } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { CARD_CODE_STATUSES } from '../../card-codes/statuses'

const MAX_ID_LENGTH = 32
const MAX_NOTE_LENGTH = 500

const updateCardCodesSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().max(MAX_ID_LENGTH)]).optional(),
  ids: z.array(z.union([z.number().int().positive(), z.string().max(MAX_ID_LENGTH)])).max(500, '单次最多更新 500 个点歌券').optional(),
  status: z.enum(CARD_CODE_STATUSES).optional(),
  note: z.union([z.string().max(MAX_NOTE_LENGTH), z.null()]).optional()
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey
  if (!apiKey) {
    throw createError({ statusCode: 401, message: 'API认证失败' })
  }

  const operatorId = Number(apiKey.createdByUserId)
  if (!Number.isInteger(operatorId) || operatorId <= 0) {
    throw createError({ statusCode: 400, message: 'API Key 缺少有效创建者，无法执行点歌券状态变更' })
  }

  try {
    const body = await readBody(event) ?? {}
    const validatedData = updateCardCodesSchema.parse(body)
    const rawIds = [
      ...(validatedData.id !== undefined ? [validatedData.id] : []),
      ...(validatedData.ids || [])
    ]
    const ids = Array.from(new Set(
      rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    ))

    if (!ids.length) {
      throw createError({ statusCode: 400, message: '缺少有效点歌券ID' })
    }

    const updateObj: any = { updatedAt: new Date() }
    const status = validatedData.status
    if (status) {
      updateObj.status = status
      if (status === 'REDEEMED') {
        updateObj.redeemedBy = operatorId
        updateObj.redeemedAt = new Date()
        updateObj.lockedBy = null
        updateObj.lockedAt = null
      }
      if (status === 'LOCKED') {
        updateObj.lockedBy = operatorId
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
    }
    if ('note' in validatedData) {
      updateObj.note = typeof validatedData.note === 'string' ? validatedData.note.trim() || null : validatedData.note
    }
    if (!status && !('note' in validatedData)) {
      throw createError({ statusCode: 400, message: '没有需要更新的字段' })
    }

    const updatedCardCodes = await db.transaction(async (tx) => {
      const beforeRows = await tx
        .select({
          id: cardCodes.id,
          code: cardCodes.code,
          status: cardCodes.status
        })
        .from(cardCodes)
        .where(inArray(cardCodes.id, ids))
      const beforeMap = new Map(beforeRows.map((row) => [row.id, row]))

      const updatedRows = await tx.update(cardCodes).set(updateObj).where(inArray(cardCodes.id, ids)).returning()

      if (status === 'REDEEMED' && updatedRows.length > 0) {
        const logsToInsert = updatedRows
          .filter((row) => {
            const before = beforeMap.get(row.id)
            return before && before.status !== status
          })
          .map((row) => ({
            cardCodeId: row.id,
            codeSnapshot: row.code,
            redeemedBy: operatorId,
            redeemedAt: row.redeemedAt || new Date(),
            source: 'OPEN_API_MANUAL',
            songId: null
          }))

        if (logsToInsert.length > 0) {
          await tx.insert(cardCodeRedeemLogs).values(logsToInsert)
        }
      }

      return updatedRows
    })

    return {
      success: true,
      message: '点歌券更新成功',
      data: {
        cardCodes: updatedCardCodes,
        updated: updatedCardCodes.length,
        requested: ids.length
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    if (err.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: `请求参数验证失败：${(err.issues || err.errors).map((issue: any) => issue.message).join(', ')}`
      })
    }
    console.error('开放API更新点歌券失败', err)
    throw createError({ statusCode: 500, message: '更新点歌券失败' })
  }
})
