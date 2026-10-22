import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { getAdminPasswordViolation } from '~~/server/utils/admin-password-policy'
import { assertCanAssignRole, canManageUsers, ROLE_ORDER } from '~~/server/utils/rbac'

const normalizeRequiredText = (value: unknown) => String(value || '').trim()
const normalizeOptionalText = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

export default defineEventHandler(async (event) => {
  // 权限：user.manage（ADMIN 及以上）；未登录 401 / 账号异常 403 / 缺权限 403
  const user = await canManageUsers(event)

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
    // 检查用户名是否已存在
    const existingUserResult = await db
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

    // 角色权限控制：ADMIN 只能创建 USER / SONG_ADMIN，SUPER_ADMIN 可创建任意角色
    // （未知角色值沿用旧行为：忽略并落到默认 USER；不满足层级规则则 403）
    let validRole = 'USER'
    if (typeof body.role === 'string' && ROLE_ORDER.includes(body.role)) {
      assertCanAssignRole(event, body.role, { message: '管理员只能创建用户和歌曲管理员角色' })
      validRole = body.role
    }

    // 状态验证
    let validStatus = 'active'
    if (body.status && ['active', 'withdrawn', 'graduate'].includes(body.status)) {
      validStatus = body.status
    }

    // 创建用户
    const newUserResult = await db
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

    return {
      success: true,
      user: newUser,
      message: '用户创建成功'
    }
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
