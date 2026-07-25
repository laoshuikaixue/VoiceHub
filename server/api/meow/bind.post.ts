import { createError, defineEventHandler, readBody } from 'h3'

import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, eq, ne } from 'drizzle-orm'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import {
  delStore,
  delStoreIfValue,
  getStore,
  hashStateCode,
  incrStore,
  parseStoreJson,
  setStore,
  verifyStateCode
} from '~~/server/utils/captchaStore'
import { randomInt } from 'node:crypto'

// 生成6位数字验证码
function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString()
}

export default defineEventHandler(async (event) => {
  try {
    // 从认证中间件获取用户信息
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '请先登录'
      })
    }

    const userId = user.id
    const body = await readBody(event)
    const { action, meowId, verificationCode } = body

    // 如果是验证并绑定操作
    if (action === 'verify_and_bind' && verificationCode) {
      const stateKey = `meow-bind:${userId}`
      const storedRaw = await getStore(stateKey)
      const storedData = parseStoreJson<{
        meowId: string
        codeHash: string
        expiresAt: number
      }>(storedRaw)
      if (
        !storedData ||
        typeof storedData.meowId !== 'string' ||
        typeof storedData.codeHash !== 'string' ||
        !Number.isFinite(storedData.expiresAt)
      ) {
        if (storedRaw) await delStoreIfValue(stateKey, storedRaw)
        throw createError({
          statusCode: 400,
          message: '验证码已过期，请重新发送'
        })
      }

      if (storedData.meowId !== meowId) {
        throw createError({
          statusCode: 400,
          message: '验证码不匹配'
        })
      }

      const now = getServerTimestamp()
      if (now > storedData.expiresAt) {
        await delStoreIfValue(stateKey, storedRaw!)
        throw createError({
          statusCode: 400,
          message: '验证码已过期，请重新发送'
        })
      }

      const remainingTtl = Math.max(1, Math.ceil((storedData.expiresAt - now) / 1000))
      const attemptKey = `${stateKey}:attempts:${storedData.codeHash}`
      const attemptCount = await incrStore(attemptKey, remainingTtl)

      if (attemptCount > 5) {
        await delStoreIfValue(stateKey, storedRaw!)
        await delStore(attemptKey)
        throw createError({ statusCode: 400, message: '验证码错误次数过多，请重新发送' })
      }

      if (!verifyStateCode(stateKey, String(verificationCode), storedData.codeHash)) {
        if (attemptCount >= 5) {
          await delStoreIfValue(stateKey, storedRaw!)
          await delStore(attemptKey)
          throw createError({ statusCode: 400, message: '验证码错误次数过多，请重新发送' })
        }
        throw createError({
          statusCode: 400,
          message: '验证码错误'
        })
      }

      if (!(await delStoreIfValue(stateKey, storedRaw!))) {
        throw createError({ statusCode: 400, message: '验证码已使用，请重新发送' })
      }
      await delStore(attemptKey)

      // 验证通过，绑定账号
      await db
        .update(users)
        .set({
          meowNickname: meowId,
          meowBoundAt: new Date()
        })
        .where(eq(users.id, userId))

      return {
        success: true,
        message: 'MeoW 账号绑定成功！'
      }
    }

    // 如果是发送验证码操作
    if (action === 'send_verification') {
      if (!meowId || !meowId.trim()) {
        throw createError({
          statusCode: 400,
          message: '请输入 MeoW 用户 ID'
        })
      }

      // 验证用户ID格式
      if (meowId.includes('/')) {
        throw createError({
          statusCode: 400,
          message: '用户 ID 不能包含斜杠'
        })
      }

      // 检查用户是否存在
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      const userExists = userResult[0]

      if (!userExists) {
        throw createError({
          statusCode: 404,
          message: '用户不存在'
        })
      }

      // 检查是否有其他用户绑定了相同的 MeoW ID（仅用于记录，不阻止绑定）
      const existingUsers = await db
        .select({
          name: users.name,
          username: users.username
        })
        .from(users)
        .where(and(eq(users.meowNickname, meowId), ne(users.id, userId)))

      if (existingUsers.length > 0) {
        console.log(
          `MeoW ID "${meowId}" 已被 ${existingUsers.length} 个其他用户绑定:`,
          existingUsers.map((u) => `${u.name}(${u.username})`).join(', ')
        )
      }

      // 生成验证码
      const code = generateVerificationCode()
      const expiresAt = getServerTimestamp() + 5 * 60 * 1000 // 5分钟过期
      const stateKey = `meow-bind:${userId}`
      const storedValue = JSON.stringify({
        meowId,
        codeHash: hashStateCode(stateKey, code),
        expiresAt
      })

      // 存储验证码
      await setStore(stateKey, storedValue, 5 * 60)

      // 发送验证码到 MeoW
      const message = `VoiceHub 账号绑定验证码：${code}（5分钟内有效）`
      const title = 'VoiceHub 账号绑定'

      try {
        // 使用 GET 请求发送验证码
        const meowUrl = `https://api.chuckfang.com/${encodeURIComponent(meowId)}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`

        const response = await fetch(meowUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'VoiceHub/1.0'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const result = await response.json()

        if (result.status !== 200) {
          throw new Error(result.message || '发送失败')
        }

        return {
          success: true,
          message: '验证码已发送到您的 MeoW，请查收并输入验证码完成绑定',
          requiresVerification: true
        }
      } catch (error) {
        // 清除验证码
        await delStoreIfValue(stateKey, storedValue)

        console.error('发送 MeoW 验证码失败:', error)
        throw createError({
          statusCode: 500,
          message: '发送验证码失败，请检查 MeoW ID 是否正确或稍后重试'
        })
      }
    }

    // 如果不是有效的操作
    throw createError({
      statusCode: 400,
      message: '无效的操作'
    })
  } catch (error: any) {
    console.error('MeoW 绑定失败:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: '绑定失败，请稍后重试'
    })
  }
})
