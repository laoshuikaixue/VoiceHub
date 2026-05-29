import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const body = await readBody(event)

  const rawCodes = Array.isArray(body.codes) ? body.codes : body.codes ? [body.codes] : []
  const codes = rawCodes.map((c: string) => String(c).trim()).filter(Boolean)

  const batchCount = Number.isInteger(body.count) ? Number(body.count) : 0
  const prefix = typeof body.prefix === 'string' ? body.prefix.trim() : ''
  const length = Number.isInteger(body.length) ? Number(body.length) : 12
  const charset = typeof body.charset === 'string' && body.charset.trim() ? body.charset.trim() : 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  const generatedCodes: string[] = []
  if (batchCount > 0) {
    const makeRandom = () => {
      let code = prefix
      for (let i = 0; i < Math.max(4, length); i++) {
        code += charset.charAt(Math.floor(Math.random() * charset.length))
      }
      return code
    }

    while (generatedCodes.length < batchCount) {
      const next = makeRandom()
      if (!generatedCodes.includes(next) && !codes.includes(next)) {
        generatedCodes.push(next)
      }
    }
  }

  const finalCodes = [...codes, ...generatedCodes]
  if (!finalCodes.length) {
    throw createError({ statusCode: 400, message: '请提供要创建的卡密或生成数量' })
  }

  try {
    const uniqueCodes = [...new Set(finalCodes)]
    const existingRows = await db
      .select({ code: cardCodes.code })
      .from(cardCodes)
      .where(inArray(cardCodes.code, uniqueCodes))
    const existingCodes = new Set(existingRows.map((row) => row.code))
    const insertCodes = uniqueCodes.filter((code) => !existingCodes.has(code))

    if (!insertCodes.length) {
      throw createError({ statusCode: 400, message: '这些卡密已经存在，无需重复创建' })
    }

    const inserts = insertCodes.map((c: string) => ({
      code: c,
      status: 'AVAILABLE',
      note: typeof body.note === 'string' ? body.note.trim() || null : null
    }))
    const res = await db.insert(cardCodes).values(inserts).returning()
    return {
      success: true,
      data: res,
      skipped: uniqueCodes.length - insertCodes.length
    }
  } catch (err) {
    console.error('创建卡密失败', err)
    throw createError({ statusCode: 500, message: '创建卡密失败' })
  }
})
