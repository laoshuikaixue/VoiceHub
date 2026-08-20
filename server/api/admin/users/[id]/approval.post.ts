import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { db } from '~/drizzle/db'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { validateGradeClassPair } from '~~/server/utils/register-validation'

// 注册审核：approve 通过（可修改注册信息），reject 拒绝（删除账户并记录理由）
export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const userId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { action, reason } = body

  if (!action || !['approve', 'reject'].includes(action)) {
    throw createError({
      statusCode: 400,
      message: 'action 必须为 approve 或 reject'
    })
  }

  // 目标用户必须存在且处于待审核状态
  const targetResult = await db
    .select({
      id: users.id,
      status: users.status
    })
    .from(users)
    .where(eq(users.id, parseInt(userId)))
    .limit(1)

  if (targetResult.length === 0) {
    throw createError({
      statusCode: 404,
      message: '用户不存在'
    })
  }

  const targetUser = targetResult[0]
  if (targetUser.status !== 'pending') {
    throw createError({
      statusCode: 400,
      message: '仅待审核用户可执行审核操作'
    })
  }

  const currentTime = getBeijingTime()

  if (action === 'approve') {
    // 年级与班级必须成对修改（或全部不修改）
    const gradeClassError = validateGradeClassPair(body.grade, body.class)
    if (gradeClassError) {
      throw createError({
        statusCode: 400,
        message: gradeClassError.message
      })
    }

    // 审核通过，可同步修改注册信息（未提供的字段保持不变）
    const updateData: Record<string, unknown> = {
      status: 'active',
      statusChangedAt: currentTime,
      statusChangedBy: user.id
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
      await tx.update(users).set(updateData).where(eq(users.id, parseInt(userId)))
      await tx.insert(userStatusLogs).values({
        userId: parseInt(userId),
        oldStatus: 'pending',
        newStatus: 'active',
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : '注册审核通过',
        operatorId: user.id,
        createdAt: currentTime
      })
    })

    return {
      success: true,
      message: '注册审核通过'
    }
  }

  // 拒绝：删除账户，理由记入状态日志（在删除前写入，保证审计留痕）
  const rejectReason = typeof reason === 'string' && reason.trim() ? reason.trim() : '注册审核拒绝'

  await db.transaction(async (tx) => {
    await tx.insert(userStatusLogs).values({
      userId: parseInt(userId),
      oldStatus: 'pending',
      newStatus: 'rejected',
      reason: rejectReason,
      operatorId: user.id,
      createdAt: currentTime
    })
    await tx.delete(users).where(eq(users.id, parseInt(userId)))
  })

  return {
    success: true,
    message: '注册申请已拒绝'
  }
})