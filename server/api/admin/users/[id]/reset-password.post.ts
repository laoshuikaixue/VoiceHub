import { updateUserPassword } from '~~/server/services/userService'
import {
  PASSWORD_AUDIT_ACTIONS,
  getPasswordAuditContext,
  recordPasswordAudit
} from '~~/server/services/passwordSecurityService'

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
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!newPassword) {
    throw createError({
      statusCode: 400,
      message: '新密码不能为空'
    })
  }

  try {
    // 禁止对自身进行密码重置（通过用户管理界面）
    if (id === user.id) {
      throw createError({
        statusCode: 400,
        message: '禁止在用户管理中重置自己的密码'
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
