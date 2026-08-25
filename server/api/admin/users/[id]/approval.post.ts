import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { validateGradeClassPair } from '~~/server/utils/register-validation'

// 注册审核：approve 通过（可修改注册信息），reject 拒绝（删除账户并记录理由与用户快照）
export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const operator = event.context.user
  if (!operator || !['ADMIN', 'SUPER_ADMIN'].includes(operator.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有权限访问')
  }

  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { action, reason } = body

  if (!action || !['approve', 'reject'].includes(action)) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, 'action 必须为 approve 或 reject')
  }

  // 目标用户必须存在且处于待审核状态
  const userIdNumber = Number(userId)
  if (!Number.isInteger(userIdNumber) || userIdNumber <= 0) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '无效的用户 ID')
  }

  const targetResult = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      status: users.status
    })
    .from(users)
    .where(eq(users.id, userIdNumber))
    .limit(1)

  if (targetResult.length === 0) {
    throw createApiError(404, SERVER_ERROR_CODES.COMMON_TARGET_NOT_FOUND, '用户不存在')
  }

  const targetUser = targetResult[0]
  if (targetUser.status !== 'pending') {
    throw createApiError(400, SERVER_ERROR_CODES.USER_NOT_PENDING, '仅待审核用户可执行审核操作')
  }

  const currentTime = getServerDate()

  if (action === 'approve') {
    // 年级与班级必须成对修改（或全部不修改）
    const gradeClassError = validateGradeClassPair(body.grade, body.class)
    if (gradeClassError) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, gradeClassError.message)
    }

    // 审核通过，可同步修改注册信息（未提供的字段保持不变）
    const updateData: Record<string, unknown> = {
      status: 'active',
      statusChangedAt: currentTime,
      statusChangedBy: operator.id
    }
    if (typeof body.name === 'string') {
      updateData.name = body.name.trim()
    }
    if (typeof body.grade === 'string') {
      updateData.grade = body.grade.trim() || null
    }
    if (typeof body.class === 'string') {
      updateData.class = body.class.trim() || null
    }
    if (typeof body.remark === 'string') {
      updateData.remark = body.remark.trim() || null
    }

    await db.transaction(async (tx) => {
      // 并发防护：仅当用户仍处于 pending 时才通过（防止另一管理员已处理后重复写入）
      const updated = await tx
        .update(users)
        .set(updateData)
        .where(and(eq(users.id, userIdNumber), eq(users.status, 'pending')))
        .returning({ id: users.id })
      if (updated.length === 0) {
        throw createApiError(409, SERVER_ERROR_CODES.USER_NOT_PENDING, '该用户已不在待审核状态，请刷新后重试')
      }
      await tx.insert(userStatusLogs).values({
        userId: userIdNumber,
        username: targetUser.username,
        name: targetUser.name,
        oldStatus: 'pending',
        newStatus: 'active',
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : '注册审核通过',
        operatorId: operator.id,
        createdAt: currentTime
      })
    })

    return {
      success: true,
      message: '注册审核通过'
    }
  }

  // 拒绝：删除账户，日志保存用户快照（用户删除后审计仍可追溯）
  const rejectReason = typeof reason === 'string' && reason.trim() ? reason.trim() : '注册审核拒绝'

  await db.transaction(async (tx) => {
    // 并发防护：仅当用户仍处于 pending 时才删除（防止删除已被其他管理员处理的用户）
    const deleted = await tx
      .delete(users)
      .where(and(eq(users.id, userIdNumber), eq(users.status, 'pending')))
      .returning({ id: users.id })
    if (deleted.length === 0) {
      throw createApiError(409, SERVER_ERROR_CODES.USER_NOT_PENDING, '该用户已不在待审核状态，请刷新后重试')
    }
    await tx.insert(userStatusLogs).values({
      userId: userIdNumber,
      username: targetUser.username,
      name: targetUser.name,
      oldStatus: 'pending',
      newStatus: 'rejected',
      reason: rejectReason,
      operatorId: operator.id,
      createdAt: currentTime
    })
  })

  return {
    success: true,
    message: '注册申请已拒绝'
  }
})