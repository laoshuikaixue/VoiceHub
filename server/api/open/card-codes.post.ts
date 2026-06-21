import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import crypto from 'crypto'

const MAX_BATCH_COUNT = 10000
const DB_CHUNK_SIZE = 500
const MAX_CODE_LENGTH = 128
const MAX_PREFIX_LENGTH = 32
const MAX_CHARSET_LENGTH = 128
const MAX_NOTE_LENGTH = 500
const MIN_RANDOM_SPACE_MULTIPLIER = 10
const DEFAULT_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const createCardCodesSchema = z.object({
  codes: z
    .union([
      z.string().max(MAX_CODE_LENGTH),
      z.array(z.string().max(MAX_CODE_LENGTH)).max(MAX_BATCH_COUNT)
    ])
    .optional(),
  count: z.number().int().min(0).max(MAX_BATCH_COUNT).optional(),
  prefix: z.string().max(MAX_PREFIX_LENGTH).optional(),
  length: z.number().int().min(4).max(64).optional(),
  charset: z.string().max(MAX_CHARSET_LENGTH).optional(),
  note: z.union([z.string().max(MAX_NOTE_LENGTH), z.null()]).optional()
})

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey
  if (!apiKey) {
    throw createError({ statusCode: 401, message: 'API认证失败' })
  }

  try {
    const body = await readBody(event) ?? {}
    const validatedData = createCardCodesSchema.parse(body)

    const rawCodes = Array.isArray(validatedData.codes)
      ? validatedData.codes
      : validatedData.codes
        ? [validatedData.codes]
        : []
    const codes = rawCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
    const manualCodeSet = new Set(codes)
    const generatedCodeSet = new Set<string>()
    const batchCount = validatedData.count || 0
    const prefix = typeof validatedData.prefix === 'string' ? validatedData.prefix.trim().toUpperCase() : ''
    const length = validatedData.length || 12
    const charsetInput = typeof validatedData.charset === 'string' && validatedData.charset.trim()
      ? validatedData.charset.trim().toUpperCase()
      : DEFAULT_CHARSET
    const charset = [...new Set(charsetInput.split(''))].join('')

    if (!charset) {
      throw createError({ statusCode: 400, message: '字符集不能为空' })
    }
    if (manualCodeSet.size + batchCount > MAX_BATCH_COUNT) {
      throw createError({ statusCode: 400, message: `单次最多创建 ${MAX_BATCH_COUNT} 个点歌券` })
    }

    if (batchCount > 0) {
      const charsetSet = new Set(charset.split(''))
      const generatedNamespaceManualCount = codes.filter((code) => {
        if (!code.startsWith(prefix) || code.length !== prefix.length + length) return false
        return code.slice(prefix.length).split('').every((char) => charsetSet.has(char))
      }).length
      const maxPossibleCodes = BigInt(charset.length) ** BigInt(length)
      const requiredSpace = BigInt(batchCount + generatedNamespaceManualCount) * BigInt(MIN_RANDOM_SPACE_MULTIPLIER)
      if (maxPossibleCodes < requiredSpace) {
        throw createError({
          statusCode: 400,
          message: '可用字符集空间过小或长度不足，容易导致生成碰撞和性能问题，请增大字符集或长度'
        })
      }

      const makeRandom = () => {
        let code = prefix
        for (let i = 0; i < length; i++) {
          code += charset.charAt(crypto.randomInt(0, charset.length))
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
          message: '可用字符集过小或长度不足，无法生成足够数量的唯一点歌券，请增大字符集或长度'
        })
      }
    }

    const finalCodes = [...codes, ...generatedCodeSet]
    if (!finalCodes.length) {
      throw createError({ statusCode: 400, message: '请提供要创建的点歌券或生成数量' })
    }
    if (finalCodes.length > MAX_BATCH_COUNT) {
      throw createError({ statusCode: 400, message: `单次最多创建 ${MAX_BATCH_COUNT} 个点歌券` })
    }

    const uniqueCodes = [...new Set(finalCodes)]
    const existingCodes = new Set<string>()

    for (let i = 0; i < uniqueCodes.length; i += DB_CHUNK_SIZE) {
      const chunk = uniqueCodes.slice(i, i + DB_CHUNK_SIZE)
      const existingRows = await db
        .select({ code: cardCodes.code })
        .from(cardCodes)
        .where(inArray(cardCodes.code, chunk))
      for (const row of existingRows) {
        existingCodes.add(row.code)
      }
    }

    const insertCodes = uniqueCodes.filter((code) => !existingCodes.has(code))

    if (!insertCodes.length) {
      throw createError({ statusCode: 400, message: '这些点歌券已经存在，无需重复创建' })
    }

    const note = typeof validatedData.note === 'string' ? validatedData.note.trim() || null : null
    const inserts = insertCodes.map((code) => ({
      code,
      status: 'AVAILABLE' as const,
      note
    }))
    const createdCardCodes = await db.transaction(async (tx) => {
      const rows: any[] = []
      for (let i = 0; i < inserts.length; i += DB_CHUNK_SIZE) {
        const chunk = inserts.slice(i, i + DB_CHUNK_SIZE)
        const result = await tx.insert(cardCodes).values(chunk).onConflictDoNothing().returning()
        rows.push(...result)
      }
      return rows
    })

    if (!createdCardCodes.length) {
      throw createError({ statusCode: 400, message: '这些点歌券已经存在，无需重复创建' })
    }

    return {
      success: true,
      message: '点歌券创建成功',
      data: {
        cardCodes: createdCardCodes,
        created: createdCardCodes.length,
        skipped: uniqueCodes.length - createdCardCodes.length
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    if (err.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: `请求参数验证失败：${(err.issues || err.errors).map((issue: any) => issue.message).join(', ')}`
      })
    }
    console.error('开放API创建点歌券失败', err)
    throw createError({ statusCode: 500, message: '创建点歌券失败' })
  }
})
