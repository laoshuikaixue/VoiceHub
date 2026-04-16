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

  const generatedCodes: string[] = []
  const maxAttempts = Math.max(20, requestedCount * 8)
  let attempts = 0

  while (generatedCodes.length < requestedCount && attempts < maxAttempts) {
    attempts += 1

    const now = new Date()
    const rawCode = createRawVoucherCode()
    const codeHash = hashVoucherCode(rawCode)
    const codeTail = getVoucherCodeTail(rawCode)

    const inserted = await db
      .insert(voucherCodes)
      .values({
        codeHash,
        codeTail,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoNothing({ target: voucherCodes.codeHash })
      .returning({ id: voucherCodes.id })

    if (inserted.length > 0) {
      generatedCodes.push(rawCode)
    }
  }

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
