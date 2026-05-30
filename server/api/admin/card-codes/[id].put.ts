import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: '点歌券ID无效' })
  }

  const body = await readBody(event)
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  const note = typeof body.note === 'string' ? body.note.trim() : null

  if (!status) {
    throw createError({ statusCode: 400, message: '需要提供状态' })
  }

  try {
    const schema = await import('~/drizzle/schema')

    const updated = await db.transaction(async (tx) => {
      // 获取当前状态
      const rows = await tx.select().from(schema.cardCodes).where(eq(schema.cardCodes.id, id)).limit(1)
      const current = rows[0]
      if (!current) throw createError({ statusCode: 404, message: '点歌券未找到' })

      const newValues: any = { updatedAt: new Date() }
      const now = new Date()

      if (status === 'REDEEMED') {
        newValues.status = 'REDEEMED'
        newValues.redeemedBy = user.id
        newValues.redeemedAt = now
        // 清理锁定信息
        newValues.lockedBy = null
        newValues.lockedAt = null
      } else if (status === 'AVAILABLE') {
        newValues.status = 'AVAILABLE'
        newValues.lockedBy = null
        newValues.lockedAt = null
        newValues.redeemedBy = null
        newValues.redeemedAt = null
      } else if (status === 'LOCKED') {
        newValues.status = 'LOCKED'
        newValues.lockedBy = user.id
        newValues.lockedAt = now
      } else if (status === 'INVALID') {
        newValues.status = 'INVALID'
      } else {
        throw createError({ statusCode: 400, message: '不支持的状态值' })
      }

      if (note !== null) newValues.note = note

      const res = await tx.update(schema.cardCodes).set(newValues).where(eq(schema.cardCodes.id, id)).returning()
      const newRow = res[0]

      // 写日志（对于 REDEEMED 和 AVAILABLE 操作写入兑换/变更日志，来源标记为 ADMIN）
      try {
        if (['REDEEMED', 'AVAILABLE'].includes(status)) {
          await tx.insert(schema.cardCodeRedeemLogs).values({
            cardCodeId: id,
            codeSnapshot: newRow.code,
            redeemedBy: user.id,
            redeemedAt: now,
            source: 'ADMIN',
            songId: null
          })
        }
      } catch (logErr) {
        console.error('写入点歌券日志失败:', logErr)
      }

      return newRow
    })

    return { success: true, data: updated }
  } catch (err: any) {
    console.error('更新点歌券失败:', err)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || '更新失败' })
  }
})
