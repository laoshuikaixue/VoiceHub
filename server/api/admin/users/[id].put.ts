import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { users, userStatusLogs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { updateUserPassword } from '~~/server/services/userService'
import { createSystemNotification } from '~~/server/services/notificationService'
import {
  PASSWORD_AUDIT_ACTIONS,
  getPasswordAuditContext
} from '~~/server/services/passwordSecurityService'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getAdminPasswordViolation } from '~~/server/utils/admin-password-policy'
import {
  assertAccountCredentialsWithinOperator,
  assertAccountPermissionExpansion,
  assertProtectedCodesAfterAccountChange,
  withPermissionTransaction
} from '~~/server/utils/permission-admin'
import { ROLE_TEMPLATE_KEYS, canAssignRole, hasAdminPermission } from '~~/app/utils/admin-permissions'
import { getServerDate } from '~~/server/utils/serverTime'

const normalizeRequiredText = (value: unknown) => String(value || '').trim()
const normalizeOptionalText = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const roleNames: Record<string, string> = {
  USER: '用户',
  SONG_ADMIN: '歌曲管理员',
  ADMIN: '管理员',
  SUPER_ADMIN: '超级管理员'
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const result = await withPermissionTransaction(event, async (tx, templates) => {
      const user = event.context.user

      const userId = getRouterParam(event, 'id')
      const userIdNum = Number.parseInt(String(userId), 10)
      if (!Number.isInteger(userIdNum) || userIdNum <= 0) {
        throw createError({
          statusCode: 400,
          message: '无效的用户ID'
        })
      }

      const { name, username, password, role, grade, class: userClass, status } = body || {}
      const normalizedName = normalizeRequiredText(name)
      const normalizedUsername = normalizeRequiredText(username)

      // 验证必填字段
      if (!normalizedName || !normalizedUsername) {
        throw createError({
          statusCode: 400,
          message: '姓名和用户名为必填项'
        })
      }

      // 检查用户是否存在
      const existingUser = await tx.select().from(users).where(eq(users.id, userIdNum)).limit(1)

      if (existingUser.length === 0) {
        throw createError({
          statusCode: 404,
          message: '用户不存在'
        })
      }

      const targetUser = existingUser[0]!

      // 1. 禁止修改系统初始超级管理员 (ID: 1)
      if (targetUser.id === 1) {
        throw createError({
          statusCode: 403,
          message: '无法修改系统初始超级管理员'
        })
      }

      // 2. 禁止对自身进行任何用户管理操作（包括角色、资料、状态、密码等）
      // 使用 String 转换确保 ID 比较的准确性
      if (String(userId) === String(user.id)) {
        throw createError({
          statusCode: 400,
          message: '禁止在用户管理中修改自己的账户'
        })
      }

      // 3. 越级修改保护
      // 如果目标用户是 SUPER_ADMIN，操作者必须是 SUPER_ADMIN
      if (targetUser.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
        throw createError({
          statusCode: 403,
          message: '权限不足：普通管理员无法修改超级管理员信息'
        })
      }

      // 检查用户名是否被其他用户使用
      if (normalizedUsername !== targetUser.username) {
        const duplicateUser = await tx
          .select()
          .from(users)
          .where(eq(users.username, normalizedUsername))
          .limit(1)

        if (duplicateUser.length > 0) {
          throw createError({
            statusCode: 400,
            message: '用户名已被其他用户使用'
          })
        }
      }

      // 角色权限控制
      let validRole = targetUser.role
      if (role) {
        if (!ROLE_TEMPLATE_KEYS.includes(role)) {
          throw createError({
            statusCode: 400,
            message: '无效的用户角色'
          })
        }
      }

      if (role && role !== targetUser.role) {
        if (!canAssignRole(user, role)) {
          throw createApiError(
            403,
            SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
            '没有分配该角色的权限'
          )
        }
        validRole = role
      }

      // 验证status字段的有效性
      if (status && !['active', 'withdrawn', 'graduate'].includes(status)) {
        throw createError({
          statusCode: 400,
          message: '用户状态只能是 active, withdrawn 或 graduate'
        })
      }

      // 待审核用户不得通过编辑接口直接置为 active（须走注册审核流程）
      if (targetUser.status === 'pending' && status === 'active') {
        throw createApiError(
          400,
          SERVER_ERROR_CODES.USER_NOT_PENDING,
          '待审核用户需通过注册审核流程处理'
        )
      }

      // 站点级能力安全阀：降级角色或停用账号会让该账号退出持有者集合，可能让能力无人可用
      const { permissions: targetPermissions } = targetUser
      const nextStatus = status && status !== targetUser.status ? status : targetUser.status
      if (validRole !== targetUser.role || nextStatus !== targetUser.status) {
        await assertProtectedCodesAfterAccountChange(
          userIdNum,
          nextStatus === 'active'
            ? { id: userIdNum, role: validRole, permissions: targetPermissions }
            : null,
          user.id,
          tx,
          templates
        )
      }

      assertAccountPermissionExpansion(
        targetUser,
        { ...targetUser, role: validRole, status: nextStatus },
        templates,
        user.perms ?? []
      )

      // 准备更新数据
      const updateData = {
        name: normalizedName,
        username: normalizedUsername,
        role: validRole,
        grade: normalizeOptionalText(grade),
        class: normalizeOptionalText(userClass),
        ...(status && status !== targetUser.status
          ? {
              status,
              statusChangedAt: getServerDate(),
              statusChangedBy: user.id
            }
          : {})
      }

      // 如果提供了密码，则使用统一服务更新密码
      if (password) {
        if (!hasAdminPermission(user, 'users:reset-password')) {
          throw createApiError(
            403,
            SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION,
            '没有重置密码的权限'
          )
        }
        assertAccountCredentialsWithinOperator(targetUser, templates, user.perms ?? [])
        const trimmedPassword = String(password).trim()
        // 管理员重置为临时密码且 forceReset 强制用户登录后修改，仅做基础校验不要求完整复杂度
        const violation = getAdminPasswordViolation(trimmedPassword)
        if (violation) {
          throw createApiError(400, violation.code, violation.message)
        }

        await updateUserPassword(targetUser.id, trimmedPassword, {
          forceReset: true,
          executor: tx,
          auditContext: {
            action: PASSWORD_AUDIT_ACTIONS.RESET_PASSWORD,
            actorId: user.id,
            ...getPasswordAuditContext(event)
          }
        })
      }

      // 更新用户其他信息
      const updatedUser = await tx
        .update(users)
        .set(updateData)
        .where(eq(users.id, userIdNum))
        .returning({
          id: users.id,
          name: users.name,
          username: users.username,
          role: users.role,
          grade: users.grade,
          class: users.class,
          status: users.status,
          statusChangedAt: users.statusChangedAt,
          statusChangedBy: users.statusChangedBy,
          lastLogin: users.lastLogin,
          lastLoginIp: users.lastLoginIp,
          passwordChangedAt: users.passwordChangedAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        })

      // 如果状态发生变更，记录到状态变更日志
      if (status && status !== targetUser.status) {
        await tx.insert(userStatusLogs).values({
          userId: targetUser.id,
          oldStatus: targetUser.status,
          newStatus: status,
          reason: `管理员${user.name || user.username}修改用户状态`,
          operatorId: user.id
        })
      }

      return {
        updatedUser: updatedUser[0]!,
        targetId: targetUser.id,
        oldRole: targetUser.role,
        newRole: validRole
      }
    })
    if (result.oldRole !== result.newRole) {
      const oldRoleName = roleNames[result.oldRole] || result.oldRole
      const newRoleName = roleNames[result.newRole] || result.newRole
      await createSystemNotification(
        result.targetId,
        '权限变更通知',
        `您的账户权限已由系统更新：${oldRoleName} → ${newRoleName}`
      )
    }
    return { success: true, user: result.updatedUser, message: '用户更新成功' }
  } catch (error: any) {
    console.error('更新用户失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '更新用户失败: ' + error.message
    })
  }
})
