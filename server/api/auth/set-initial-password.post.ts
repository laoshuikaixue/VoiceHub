import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { createApiError } from '~~/server/utils/apiError'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证
    const user = event.context.user
    if (!user) {
      throw createApiError(401, 'AUTH_UNAUTHORIZED', '未授权')
    }

    const body = await readBody(event)
    if (!body.newPassword) {
      throw createApiError(400, 'AUTH_NEW_PASSWORD_REQUIRED', '新密码不能为空')
    }

    // 获取用户信息
    const currentUserResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
    const currentUser = currentUserResult[0]
    if (!currentUser) {
      throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
    }

    // 检查是否需要设置初始密码
    if (currentUser.passwordChangedAt) {
      throw createApiError(400, 'AUTH_PASSWORD_ALREADY_SET', '您已经设置过密码，请使用修改密码功能')
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(body.newPassword, 10)

    // 更新密码
    await db
      .update(users)
      .set({
        password: hashedPassword,
        passwordChangedAt: getBeijingTime(),
        forcePasswordChange: false
      })
      .where(eq(users.id, user.id))

    return {
      success: true,
      message: '初始密码设置成功'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '初始密码设置失败'
    })
  }
})
