import crypto from 'node:crypto'
import { db, voucherCodes } from '~/drizzle/db'
import { getVoucherCodeTail, hashVoucherCode } from '~~/server/utils/voucher'

function createRawVoucherCode() {
  const partA = crypto.randomBytes(3).toString('hex').toUpperCase()
  const partB = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `VH-${partA}-${partB}`
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '仅管理员可生成点歌券'
    })
  }

  const body = await readBody<{ count?: number }>(event)
  const requestedCount = Number.parseInt(String(body?.count ?? 20), 10)

  if (!Number.isFinite(requestedCount) || requestedCount < 1 || requestedCount > 500) {
    throw createError({
      statusCode: 400,
      message: '生成数量必须在 1 到 500 之间'
    })
  }

  const codesToInsert: typeof voucherCodes.$inferInsert[] = []
  const rawCodesMap = new Map<string, string>()
  const maxAttempts = Math.max(1000, requestedCount * 2)
  let attempts = 0
  const now = new Date()

  while (rawCodesMap.size < requestedCount && attempts < maxAttempts) {
    attempts += 1

    const rawCode = createRawVoucherCode()
    const codeHash = hashVoucherCode(rawCode)

    if (!rawCodesMap.has(codeHash)) {
      rawCodesMap.set(codeHash, rawCode)
      codesToInsert.push({
        codeHash,
        codeTail: getVoucherCodeTail(rawCode),
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      })
    }
  }

  const inserted = codesToInsert.length > 0
    ? await db
      .insert(voucherCodes)
      .values(codesToInsert)
      .onConflictDoNothing({ target: voucherCodes.codeHash })
      .returning({ codeHash: voucherCodes.codeHash })
    : []

  const generatedCodes = inserted
    .map(row => rawCodesMap.get(row.codeHash))
    .filter((code): code is string => Boolean(code))

  return {
    success: true,
    data: {
      requestedCount,
      generatedCount: generatedCodes.length,
      partial: generatedCodes.length < requestedCount,
      codes: generatedCodes
    },
    message:
      generatedCodes.length < requestedCount
        ? `已生成 ${generatedCodes.length} 个点歌券（部分成功，建议重试补足）`
        : `已生成 ${generatedCodes.length} 个点歌券`
  }
})
