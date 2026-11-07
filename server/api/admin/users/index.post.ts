import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canAssignRole, getRoleTemplateKeys } from '~~/app/utils/admin-permissions'
import {
  assertAccountPermissionExpansion,
  withPermissionTransaction
} from '~~/server/utils/permission-admin'
import bcrypt from 'bcryptjs'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { getAdminPasswordViolation } from '~~/server/utils/admin-password-policy'
import { recordAdminAudit } from '~~/server/utils/admin-audit'

const normalizeRequiredText = (value: unknown) => String(value || '').trim()
const normalizeOptionalText = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  const body = await readBody(event)
  const normalizedName = normalizeRequiredText(body.name)
  const normalizedUsername = normalizeRequiredText(body.username)
  const initialPassword = typeof body.password === 'string' ? body.password : ''

  // 验证必填字段
  if (!normalizedName || !normalizedUsername || !initialPassword) {
    throw createError({
      statusCode: 400,
      message: '姓名、用户名和密码不能为空'
    })
  }

  const violation = getAdminPasswordViolation(initialPassword)
  if (violation) {
    throw createApiError(400, violation.code, violation.message)
  }

  try {
    return await withPermissionTransaction(event, async (tx, templates) => {
      // 检查用户名是否已存在
      const existingUserResult = await tx
        .select()
        .from(users)
        .where(eq(users.username, normalizedUsername))
        .limit(1)
      const existingUser = existingUserResult[0]

      if (existingUser) {
        throw createError({
          statusCode: 400,
          message: '用户名已存在'
        })
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(initialPassword, 10)

      let validRole = 'USER'
      if (body.role && body.role !== 'USER') {
        if (!getRoleTemplateKeys(templates).includes(body.role) || !canAssignRole(user, body.role, getRoleTemplateKeys(templates))) {
          throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '没有分配该角色的权限')
        }
        validRole = body.role
      }

      // 状态验证
      let validStatus = 'active'
      if (body.status && ['active', 'withdrawn', 'graduate'].includes(body.status)) {
        validStatus = body.status
      }

      assertAccountPermissionExpansion(
        null,
        { role: validRole, status: validStatus, permissions: null },
        templates,
        user.perms ?? []
      )

      // 创建用户
      const newUserResult = await tx
        .insert(users)
        .values({
          name: normalizedName,
          username: normalizedUsername,
          password: hashedPassword,
          role: validRole,
          status: validStatus as 'active' | 'withdrawn' | 'graduate',
          grade: normalizeOptionalText(body.grade),
          class: normalizeOptionalText(body.class)
        })
        .returning({
          id: users.id,
          name: users.name,
          username: users.username,
          role: users.role,
          status: users.status,
          grade: users.grade,
          class: users.class,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt
        })
      const newUser = newUserResult[0]

      await recordAdminAudit(event, 'user.create', {
        targetType: 'user',
        targetId: newUser.id,
        summary: { username: newUser.username, role: newUser.role }
      })

      return {
        success: true,
        user: newUser,
        message: '用户创建成功'
      }
    })
  } catch (error: any) {
    console.error('创建用户失败:', error)
    if (error?.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: '创建用户失败'
    })
  }
})
