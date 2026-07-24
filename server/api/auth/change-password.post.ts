import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { recordLoginFailure, recordLoginSuccess } from '../../services/securityService'
import { updateUserPassword } from '../../services/userService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  // 验证用户身份
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED', '未授权')
  }

  const body = await readBody(event)
  if (!body.currentPassword || !body.newPassword) {
    throw createApiError(400, 'AUTH_CURRENT_AND_NEW_PASSWORD_REQUIRED', '当前密码和新密码都是必需的')
  }

  try {
    // 查询用户详细信息
    const userDetailsResult = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    const userDetails = userDetailsResult[0]

    if (!userDetails) {
      throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(body.currentPassword, userDetails.password)

    if (!isPasswordValid) {
      // 记录安全事件
      const clientIp = getClientIP(event)
      await recordLoginFailure(userDetails.username, clientIp)

      throw createApiError(400, 'AUTH_CURRENT_PASSWORD_INCORRECT', '当前密码不正确')
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(body.newPassword, userDetails.password)
    if (isSamePassword) {
      throw createApiError(400, 'AUTH_NEW_PASSWORD_SAME_AS_CURRENT', '新密码不能与当前密码相同')
    }

    // 更新密码
    await updateUserPassword(user.id, body.newPassword)

    // 记录成功的密码修改
    const clientIp = getClientIP(event)
    await recordLoginSuccess(userDetails.username, clientIp)

    return {
      success: true,
      message: '密码修改成功'
    }
  } catch (error: any) {
    // 已格式化的错误直接抛出
    if (error.statusCode) {
      throw error
    }

    // 记录错误信息
    console.error('修改密码过程中发生未处理的错误:', error)

    // 创建错误响应
    throw createError({
      statusCode: 500,
      message: '修改密码失败: ' + (error.message || '未知错误')
    })
  }
})
