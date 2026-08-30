import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { updateUserPassword } from '~~/server/services/userService'
import {
  PASSWORD_AUDIT_ACTIONS,
  getPasswordAuditContext,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'
import { createApiError } from '~~/server/utils/apiError'
import { getAdminPasswordViolation } from '~~/server/utils/admin-password-policy'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  // 安全获取ID参数
  const params = event.context.params || {}
  const id = parseInt(params.id || '')

  if (isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: '无效的用户ID'
    })
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : ''

  // 管理员重置为临时密码且 forceReset 强制用户登录后修改，仅做基础校验不要求完整复杂度
  const violation = getAdminPasswordViolation(newPassword)
  if (violation) {
    throw createApiError(400, violation.code, violation.message)
  }

  try {
    // 查询目标用户用于越级保护
    const targetUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    const targetUser = targetUsers[0]
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 禁止对自身进行密码重置（通过用户管理界面）
    if (id === user.id) {
      throw createError({
        statusCode: 400,
        message: '禁止在用户管理中重置自己的密码'
      })
    }

    // 禁止重置系统初始超级管理员 (ID: 1)
    if (targetUser.id === 1) {
      throw createError({
        statusCode: 403,
        message: '无法重置系统初始超级管理员的密码'
      })
    }

    // 越级保护：目标用户是 SUPER_ADMIN 时，操作者必须是 SUPER_ADMIN
    if (targetUser.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw createError({
        statusCode: 403,
        message: '权限不足：普通管理员无法重置超级管理员密码'
      })
    }

    // 使用统一服务重置密码 (forceReset = true)
    await updateUserPassword(id, newPassword, {
      forceReset: true,
      auditContext: {
        action: PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD,
        actorId: user.id,
        ...getPasswordAuditContext(event)
      }
    })

    return {
      success: true,
      message: '密码重置成功'
    }
  } catch (error) {
    await recordPasswordAudit(
      event,
      id,
      PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD,
      false,
      error instanceof Error ? error.message : '管理员重置密码失败',
      user.id
    )
    console.error('重置密码失败:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({
      statusCode: 500,
      message: '重置密码失败'
    })
  }
})
