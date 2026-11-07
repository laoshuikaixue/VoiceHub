import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import {
  assertAccountPermissionExpansion,
  assertProtectedCodesAfterAccountChange,
  withPermissionTransaction
} from '~~/server/utils/permission-admin'
import { getStatusText } from '~~/server/utils/user'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const updated = await withPermissionTransaction(event, async (tx, templates) => {
      const user = event.context.user

      const userId = getRouterParam(event, 'id')

      const { status, reason } = body

      // 验证必填字段
      if (!status || !['active', 'withdrawn', 'graduate'].includes(status)) {
        throw createError({
          statusCode: 400,
          message: '状态必须为 active, withdrawn 或 graduate'
        })
      }

      if (!reason || reason.trim().length === 0) {
        throw createError({
          statusCode: 400,
          message: '变更原因为必填项'
        })
      }

      // 检查用户是否存在
      const existingUser = await tx
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          status: users.status,
          role: users.role,
          permissions: users.permissions
        })
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1)

      if (existingUser.length === 0) {
        throw createError({
          statusCode: 404,
          message: '用户不存在'
        })
      }

      const targetUser = existingUser[0]

      // 待审核用户不得通过状态接口直接置为 active（须走注册审核流程）
      if (targetUser.status === 'pending' && status === 'active') {
        throw createApiError(
          400,
          SERVER_ERROR_CODES.USER_NOT_PENDING,
          '待审核用户需通过注册审核流程处理'
        )
      }

      // 检查是否为学生用户
      if (targetUser.role !== 'USER') {
        throw createError({
          statusCode: 400,
          message: '只能修改学生用户的状态'
        })
      }

      // 检查状态是否有变化
      if (targetUser.status === status) {
        throw createError({
          statusCode: 400,
          message: '用户状态未发生变化'
        })
      }

      const currentTime = getServerDate()
      const oldStatus = targetUser.status

      const nextState = { ...targetUser, status }
      assertAccountPermissionExpansion(targetUser, nextState, templates, user.perms ?? [])
      await assertProtectedCodesAfterAccountChange(
        targetUser.id,
        status === 'active' ? nextState : null,
        user.id,
        tx,
        templates
      )
      // 更新账号与状态日志共用权限事务。
      // 更新用户状态
      await tx
        .update(users)
        .set({
          status: status,
          statusChangedAt: currentTime,
          statusChangedBy: user.id
        })
        .where(eq(users.id, parseInt(userId)))

      // 记录状态变更日志
      await tx.insert(userStatusLogs).values({
        userId: parseInt(userId),
        oldStatus: oldStatus,
        newStatus: status,
        reason: reason.trim(),
        operatorId: user.id,
        createdAt: currentTime
      })

      return {
        userId: parseInt(userId),
        oldStatus,
        newStatus: status,
        reason: reason.trim(),
        changedAt: currentTime,
        changedBy: user.name
      }
    })

    // 审计写入放在事务提交之后，避免回滚后留下成功记录
    await recordAdminAudit(event, 'user.status', {
      targetType: 'user',
      targetId: updated.userId,
      summary: {
        oldStatus: updated.oldStatus,
        newStatus: updated.newStatus,
        reason: updated.reason
      }
    })

    return {
      success: true,
      message: `用户状态已更新为${getStatusText(updated.newStatus)}`,
      data: {
        userId: updated.userId,
        oldStatus: updated.oldStatus,
        newStatus: updated.newStatus,
        changedAt: updated.changedAt,
        changedBy: updated.changedBy
      }
    }
  } catch (error) {
    console.error('更新用户状态失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '更新用户状态失败: ' + error.message
    })
  }
})
