import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import {
  delStore,
  delStoreIfValue,
  getStore,
  incrStore,
  parseStoreJson,
  verifyStateCode
} from '~~/server/utils/captchaStore'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, message: '方法不被允许' })
  }

  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }

  const body = await readBody(event)
  const email = (body?.email || '').toString().trim().toLowerCase()
  const code = (body?.code || '').toString().trim()

  if (!email || !code) {
    throw createError({ statusCode: 400, message: '邮箱与验证码不能为空' })
  }

  const stateKey = `email-verify:${user.id}`
  const recordRaw = await getStore(stateKey)
  const record = parseStoreJson<{ email: string; codeHash: string; expiresAt: number }>(recordRaw)
  if (
    !record ||
    record.email !== email ||
    typeof record.codeHash !== 'string' ||
    !Number.isFinite(record.expiresAt)
  ) {
    if (recordRaw) await delStoreIfValue(stateKey, recordRaw)
    throw createError({ statusCode: 400, message: '请先发送验证码' })
  }
  if (getServerTimestamp() > record.expiresAt) {
    await delStoreIfValue(stateKey, recordRaw!)
    throw createError({ statusCode: 400, message: '验证码已过期，请重新发送' })
  }

  const remainingTtl = Math.max(1, Math.ceil((record.expiresAt - getServerTimestamp()) / 1000))
  const attemptKey = `${stateKey}:attempts:${record.codeHash}`
  const attemptCount = await incrStore(attemptKey, remainingTtl)

  if (attemptCount > 5) {
    await delStoreIfValue(stateKey, recordRaw!)
    await delStore(attemptKey)
    throw createError({ statusCode: 400, message: '验证码错误次数过多，请重新发送' })
  }

  if (!verifyStateCode(stateKey, code, record.codeHash)) {
    if (attemptCount >= 5) {
      await delStoreIfValue(stateKey, recordRaw!)
      await delStore(attemptKey)
      throw createError({ statusCode: 400, message: '验证码错误次数过多，请重新发送' })
    }
    throw createError({ statusCode: 400, message: '验证码错误' })
  }

  if (!(await delStoreIfValue(stateKey, recordRaw!))) {
    throw createError({ statusCode: 400, message: '验证码已使用，请重新发送' })
  }
  await delStore(attemptKey)

  // 验证通过：设置邮箱为已验证
  const updatedUsers = await db
    .update(users)
    .set({ emailVerified: true })
    .where(and(eq(users.id, user.id), eq(users.email, email)))
    .returning({ id: users.id })

  if (updatedUsers.length === 0) {
    throw createError({ statusCode: 409, message: '邮箱已发生变化，请重新发送验证码' })
  }

  return { success: true, message: '邮箱验证成功' }
})
