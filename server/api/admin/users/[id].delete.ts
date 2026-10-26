import { defineEventHandler, getRouterParam } from 'h3'
import { db } from '~/drizzle/db'
import { cardCodeAssignments, cardCodes, users } from '~/drizzle/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerDate } from '~~/server/utils/serverTime'

export default defineEventHandler(async (event) => {
  const actor = event.context.user
  if (!actor) throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '需要登录')
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有权限访问')
  }
  const userId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '用户 ID 无效')
  }
  try {
    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for('update')
      if (!target) throw createApiError(404, SERVER_ERROR_CODES.USER_NOT_FOUND, '用户不存在')
      if (target.id === 1 || target.id === actor.id || (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN')) {
        throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '不能删除此账户')
      }

      const heldCards = await tx.select({ id: cardCodes.id, status: cardCodes.status })
        .from(cardCodes).where(eq(cardCodes.assignedTo, userId)).orderBy(asc(cardCodes.id)).for('update')
      const now = getServerDate()
      if (heldCards.length) {
        const ids = heldCards.map((card) => card.id)
        const availableIds = heldCards.filter((card) => card.status === 'ASSIGNED').map((card) => card.id)
        if (availableIds.length) {
          await tx.update(cardCodes).set({
            status: 'AVAILABLE', assignedTo: null, assignedAt: null, updatedAt: now
          }).where(inArray(cardCodes.id, availableIds))
        }
        // 投稿与核销状态保留，仅解除账户持有关系。
        await tx.update(cardCodes).set({ assignedTo: null, assignedAt: null, updatedAt: now })
          .where(eq(cardCodes.assignedTo, userId))
        await tx.update(cardCodeAssignments).set({
          status: 'RECYCLED', recycledAt: now, recycledBy: actor.id,
          recycledByName: actor.name || actor.username || null,
          recycleReason: '删除持有人账户', updatedAt: now
        }).where(and(inArray(cardCodeAssignments.cardCodeId, ids), eq(cardCodeAssignments.status, 'ASSIGNED')))
      }
      await tx.delete(users).where(eq(users.id, userId))
    })
    return { success: true, message: '用户删除成功' }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('删除用户失败:', error)
    throw createApiError(500, SERVER_ERROR_CODES.SONG_OPERATION_FAILED, '删除用户失败')
  }
})
