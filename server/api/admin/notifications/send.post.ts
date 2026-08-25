import { and, eq, or } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import {
  createBatchSystemNotifications,
  createSystemNotification
} from '~~/server/services/notificationService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  canSendSystemNotification,
  NOTIFICATION_CONTENT_MAX_LENGTH,
  NOTIFICATION_TITLE_MAX_LENGTH,
  resolveImportantFlag
} from '~~/server/utils/important-notification-policy'

type NotificationFilter = {
  grade?: unknown
  class?: unknown
  classes?: unknown
  userIds?: unknown
}

const supportedScopes = ['ALL', 'GRADE', 'CLASS', 'MULTI_CLASS', 'SPECIFIC_USERS'] as const

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能发送通知')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以发送系统通知'
    )
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const sender = {
    id: user.id,
    name: user.name,
    username: user.username
  }
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const rawContent = typeof body?.content === 'string' ? body.content : body?.message
  const content = typeof rawContent === 'string' ? rawContent.trim() : ''
  const important = resolveImportantFlag(body?.important)

  if (important === null) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_IMPORTANT_INVALID,
      '重要通知标记必须是布尔值'
    )
  }

  if (!title || !content) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_TITLE_CONTENT_REQUIRED,
      '通知标题和内容不能为空'
    )
  }

  if (title.length > NOTIFICATION_TITLE_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_TITLE_TOO_LONG,
      `通知标题不能超过 ${NOTIFICATION_TITLE_MAX_LENGTH} 个字符`,
      { params: [NOTIFICATION_TITLE_MAX_LENGTH] }
    )
  }

  if (content.length > NOTIFICATION_CONTENT_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.NOTIFICATION_CONTENT_TOO_LONG,
      `通知正文不能超过 ${NOTIFICATION_CONTENT_MAX_LENGTH} 个字符`,
      { params: [NOTIFICATION_CONTENT_MAX_LENGTH] }
    )
  }

  const targetUserId = body?.userId
  if (targetUserId !== undefined) {
    // 兼容旧调用方传入数字字符串的情况
    const normalizedUserId =
      typeof targetUserId === 'string' && targetUserId.trim()
        ? Number(targetUserId.trim())
        : targetUserId
    if (!Number.isInteger(normalizedUserId) || Number(normalizedUserId) <= 0) {
      throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_USER_ID_INVALID, '无效的用户 ID')
    }

    const result = await createSystemNotification(
      Number(normalizedUserId),
      title,
      content,
      important,
      sender
    )
    if (!result) {
      throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_SEND_FAILED, '发送通知失败')
    }

    return {
      success: true,
      message: '通知发送成功',
      sentCount: 1,
      totalUsers: 1
    }
  }

  const scope = typeof body?.scope === 'string' ? body.scope : ''
  if (!supportedScopes.includes(scope as (typeof supportedScopes)[number])) {
    throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_SCOPE_INVALID, '无效的通知范围')
  }

  const filter = (
    body?.filter && typeof body.filter === 'object' ? body.filter : {}
  ) as NotificationFilter
  let userIds: number[]

  // 仅向活跃状态的用户发送通知，排除已退学/毕业用户
  const activeUserCondition = eq(users.status, 'active')

  if (scope === 'ALL') {
    const allUsers = await db.select({ id: users.id }).from(users).where(activeUserCondition)
    userIds = allUsers.map((target) => target.id)
  } else if (scope === 'GRADE') {
    const grade = typeof filter.grade === 'string' ? filter.grade.trim() : ''
    if (!grade) {
      throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_GRADE_REQUIRED, '年级不能为空')
    }

    const gradeUsers = await db.select({ id: users.id }).from(users).where(and(eq(users.grade, grade), activeUserCondition))
    userIds = gradeUsers.map((target) => target.id)
  } else if (scope === 'CLASS') {
    const grade = typeof filter.grade === 'string' ? filter.grade.trim() : ''
    const className = typeof filter.class === 'string' ? filter.class.trim() : ''
    if (!grade || !className) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.NOTIFICATION_GRADE_CLASS_REQUIRED,
        '年级和班级不能为空'
      )
    }

    const classUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.grade, grade), eq(users.class, className), activeUserCondition))
    userIds = classUsers.map((target) => target.id)
  } else if (scope === 'MULTI_CLASS') {
    if (!Array.isArray(filter.classes) || filter.classes.length === 0) {
      throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_CLASSES_REQUIRED, '未选择任何班级')
    }

    const classes = filter.classes.map((entry) => {
      const candidate = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
      return {
        grade: typeof candidate.grade === 'string' ? candidate.grade.trim() : '',
        className: typeof candidate.class === 'string' ? candidate.class.trim() : ''
      }
    })

    if (classes.some((entry) => !entry.grade || !entry.className)) {
      throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_CLASSES_REQUIRED, '班级信息不完整')
    }

    const whereConditions = classes.map((entry) =>
      and(eq(users.grade, entry.grade), eq(users.class, entry.className), activeUserCondition)
    )
    const multiClassUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(or(...whereConditions))
    userIds = multiClassUsers.map((target) => target.id)
  } else {
    if (!Array.isArray(filter.userIds) || filter.userIds.length === 0) {
      throw createApiError(400, SERVER_ERROR_CODES.NOTIFICATION_USERS_REQUIRED, '未选择任何用户')
    }

    if (filter.userIds.some((id) => !Number.isInteger(id) || Number(id) <= 0)) {
      throw createApiError(
        400,
        SERVER_ERROR_CODES.NOTIFICATION_USER_ID_INVALID,
        '用户 ID 列表包含无效值'
      )
    }

    userIds = [...new Set(filter.userIds.map(Number))]
  }

  if (userIds.length === 0) {
    return {
      success: true,
      message: '没有找到符合条件的用户',
      sentCount: 0,
      totalUsers: 0
    }
  }

  const result = await createBatchSystemNotifications(userIds, title, content, important, sender)
  if (!result) {
    throw createApiError(500, SERVER_ERROR_CODES.NOTIFICATION_SEND_FAILED, '发送通知失败')
  }

  const sentCount = Array.isArray(result) ? result.length : result.count
  const totalUsers = Array.isArray(result) ? userIds.length : result.total || userIds.length

  return {
    success: true,
    message: '通知发送成功',
    sentCount,
    totalUsers
  }
})
