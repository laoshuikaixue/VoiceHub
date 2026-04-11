import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { updateUserPassword } from '~~/server/services/userService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { checkRateLimit } from '~~/server/utils/rateLimiter'

export default defineEventHandler(async (event) => {
  const clientIP = getClientIP(event)
  
  // IP 级别限流：每小时最多 10 次密码重置尝试
  const rateLimitKey = `reset_password_ip:${clientIP}`
  const limitResult = checkRateLimit(rateLimitKey, 10, 60 * 60 * 1000)
  
  if (!limitResult.isAllowed) {
    const waitMinutes = Math.ceil((limitResult.resetTime - Date.now()) / 60000)
    throw createError({ 
      statusCode: 429, 
      message: `重置密码尝试次数过多，请等待 ${waitMinutes} 分钟后再试` 
    })
  }

  const body = await readBody(event)
  const { token, newPassword } = body

  if (!token || !newPassword) {
    throw createError({ statusCode: 400, message: '参数不完整' })
  }

  if (newPassword.length < 8) {
    throw createError({ statusCode: 400, message: '密码长度不能少于8个字符' })
  }

  try {
    // 验证并解码token
    const decoded = JWTEnhanced.verify(token) as any

    if (decoded.type !== 'password_reset' || !decoded.userId || !decoded.hash) {
      throw createError({ statusCode: 400, message: '无效的重置链接' })
    }

    // 获取最新用户信息
    const userResult = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)
    const user = userResult[0]

    if (!user) {
      throw createError({ statusCode: 404, message: '用户不存在' })
    }

    // 验证 hash 是否匹配当前密码的前10位
    // 如果用户已经修改过密码，则 user.password 发生变化，旧 token 失效
    if (user.password.substring(0, 10) !== decoded.hash) {
      throw createError({ statusCode: 400, message: '该重置链接已失效（密码已被修改）' })
    }

    // 更新密码
    await updateUserPassword(user.id, newPassword)

    return { success: true, message: '密码重置成功，请使用新密码登录' }
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw createError({ statusCode: 400, message: '重置链接已过期，请重新申请' })
    }
    if (error.statusCode) throw error
    throw createError({ statusCode: 400, message: '重置密码失败：' + (error.message || '无效链接') })
  }
})
