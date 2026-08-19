import { readBody } from 'h3'
import { inArray } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { requireCardCodeAdministrator } from '#server/api/admin/card-codes/_shared'

const MAX_BATCH_COUNT = 10000

export default defineEventHandler(async (event) => {
  requireCardCodeAdministrator(event)

  const body = await readBody(event) ?? {}

  const rawCodes = Array.isArray(body.codes) ? body.codes : body.codes ? [body.codes] : []
  const codes = rawCodes.map((c: string) => String(c).trim().toUpperCase()).filter(Boolean)

  const requestedBatchCount = Number.isInteger(Number(body.count)) ? Number(body.count) : 0
  if (requestedBatchCount > MAX_BATCH_COUNT) {
    throw createError({ statusCode: 400, message: `单次最多生成 ${MAX_BATCH_COUNT} 个卡密` })
  }
  const batchCount = requestedBatchCount
  const prefix = typeof body.prefix === 'string' ? body.prefix.trim().toUpperCase() : ''
  const parsedLength = Number(body.length)
  const length = Number.isInteger(parsedLength) ? parsedLength : 12
  if (length > 64) {
    throw createError({ statusCode: 400, message: '卡密随机长度不能超过 64 位' })
  }
  const charsetInput = typeof body.charset === 'string' && body.charset.trim() ? body.charset.trim().toUpperCase() : 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const charset = [...new Set(charsetInput.split(''))].join('')
  if (!charset) {
    throw createError({ statusCode: 400, message: '字符集不能为空' })
  }

  const manualCodeSet = new Set(codes)
  const generatedCodeSet = new Set<string>()
  if (batchCount > 0) {
    const actualLength = Math.max(4, length)
    const maxPossibleCodes = charset.length ** actualLength
    if (maxPossibleCodes < batchCount) {
      throw createError({
        statusCode: 400,
        message: '可用字符集过小或长度不足，无法生成足够数量的唯一卡密，请增大字符集或长度'
      })
    }

    const makeRandom = () => {
      let code = prefix
      for (let i = 0; i < actualLength; i++) {
        code += charset.charAt(Math.floor(Math.random() * charset.length))
      }
      return code
    }

    let attempts = 0
    const maxAttempts = batchCount * 100
    while (generatedCodeSet.size < batchCount && attempts < maxAttempts) {
      attempts++
      const next = makeRandom()
      if (!generatedCodeSet.has(next) && !manualCodeSet.has(next)) {
        generatedCodeSet.add(next)
      }
    }
    if (generatedCodeSet.size < batchCount) {
      throw createError({
        statusCode: 400,
        message: '可用字符集过小或长度不足，无法生成足够数量的唯一卡密，请增大字符集或长度'
      })
    }
  }

  const finalCodes = [...codes, ...generatedCodeSet]
  if (!finalCodes.length) {
    throw createError({ statusCode: 400, message: '请提供要创建的卡密或生成数量' })
  }
  if (finalCodes.length > MAX_BATCH_COUNT) {
    throw createError({ statusCode: 400, message: `单次最多创建 ${MAX_BATCH_COUNT} 个卡密` })
  }

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
})