import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { isSecureRequest } from '~~/server/utils/request-utils'

export default defineEventHandler(async (event) => {
  try {
    // 检查认证
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '未授权'
      })
    }

    const body = await readBody(event)
    if (!body.newPassword) {
      throw createError({
        statusCode: 400,
        message: '新密码不能为空'
      })
    }

    // 获取用户信息
    const currentUserResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
    const currentUser = currentUserResult[0]
    if (!currentUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 此接口仅用于"真正的首次登录"——即用户从未设置过密码（passwordChangedAt 为空）。
    // 已设置过密码的用户即使被管理员强制改密，也必须通过 /api/auth/change-password 验证旧密码后修改，
    // 以确保操作者是本人，而非他人借助会话直接重置密码。
    if (currentUser.passwordChangedAt) {
      throw createError({
        statusCode: 400,
        message: '您已经设置过密码，请使用修改密码功能'
      })
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

    // 清除用户认证缓存，防止 verify 接口返回过期数据
    try {
      const { userCache } = await import('~~/server/utils/cache-helpers')
      await userCache.clearAuth(String(user.id))
    } catch (e) {
      console.warn('清除用户认证缓存失败:', e)
    }

    // 签发新 token（passwordChangedAt 更新后旧 token 会被中间件拒绝）
    const newToken = JWTEnhanced.generateToken(user.id, user.role)
    const isSecure = isSecureRequest(event)
    setCookie(event, 'auth-token', newToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return {
      success: true,
      message: '初始密码设置成功',
      token: newToken
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '初始密码设置失败'
    })
  }
})
