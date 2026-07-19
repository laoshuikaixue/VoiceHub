import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { updateUserPassword } from '~~/server/services/userService'
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
    if (typeof body.newPassword !== 'string' || !body.newPassword) {
      throw createError({
        statusCode: 400,
        message: '新密码不能为空'
      })
    }

    if (body.newPassword.length < 8) {
      throw createError({ statusCode: 400, message: '新密码长度至少为8位' })
    }

    // 获取用户信息
    const currentUserResult = await db
      .select({
        password: users.password,
        passwordChangedAt: users.passwordChangedAt
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    const currentUser = currentUserResult[0]
    if (!currentUser) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 检查是否需要设置初始密码
    if (currentUser.passwordChangedAt) {
      throw createError({
        statusCode: 400,
        message: '您已经设置过密码，请使用修改密码功能'
      })
    }

    // OAuth 账号可能没有可用于比对的旧密码，不能把 null 传给 bcrypt。
    if (currentUser.password && await bcrypt.compare(body.newPassword, currentUser.password)) {
      throw createError({ statusCode: 400, message: '新密码不能与当前密码相同' })
    }

    const { passwordChangedAt } = await updateUserPassword(user.id, body.newPassword)

    const newToken = JWTEnhanced.generateToken(user.id, user.role)
    setCookie(event, 'auth-token', newToken, {
      httpOnly: true,
      secure: isSecureRequest(event),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return {
      success: true,
      message: '初始密码设置成功',
      passwordChangedAt
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || '初始密码设置失败'
    })
  }
})
