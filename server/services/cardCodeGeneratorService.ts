import { and, eq, inArray, isNull, notExists } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { cardCodeAssignments, cardCodes, songs } from '~/drizzle/schema'

/**
 * 点歌券码生成工具。
 *
 * 「批量创建点歌券」与「按接收人直接生成并派发」共用同一套生成规则，
 * 保证两处产出的券码格式一致（同样的字符集与长度约束）。
 */

export const DEFAULT_CARD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 单次生成的券码数量上限 */
export const MAX_GENERATE_COUNT = 10000

export type GenerateCardCodeOptions = {
  /** 需要生成的券码数量 */
  count: number
  /** 券码前缀 */
  prefix?: string
  /** 随机部分长度 */
  length?: number
  /** 字符集 */
  charset?: string
}

export class CardCodeGenerateError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CardCodeGenerateError'
    this.statusCode = statusCode
  }
}

/**
 * 生成一批互不重复的券码。
 *
 * 不与数据库交互，仅负责随机生成与本批次内去重；
 * 与既有券码的冲突由调用方在写入前统一检查。
 */
export function generateCardCodes(options: GenerateCardCodeOptions): string[] {
  const count = Number(options.count)
  if (!Number.isInteger(count) || count <= 0) {
    throw new CardCodeGenerateError('生成数量必须为正整数')
  }
  if (count > MAX_GENERATE_COUNT) {
    throw new CardCodeGenerateError(`单次最多生成 ${MAX_GENERATE_COUNT} 个点歌券`)
  }

  const prefix = (options.prefix || '').trim().toUpperCase()
  const charsetInput = options.charset && options.charset.trim()
    ? options.charset.trim().toUpperCase()
    : DEFAULT_CARD_CHARSET
  const charset = [...new Set(charsetInput.split(''))].join('')
  if (!charset) {
    throw new CardCodeGenerateError('字符集不能为空')
  }

  const rawLength = Number(options.length)
  const actualLength = Math.max(4, Number.isInteger(rawLength) ? rawLength : 12)
  const maxPossibleCodes = charset.length ** actualLength
  if (maxPossibleCodes < count) {
    throw new CardCodeGenerateError('可用字符集过小或长度不足，无法生成足够数量的唯一点歌券，请增大字符集或长度')
  }

  const makeRandom = () => {
    let code = prefix
    for (let i = 0; i < actualLength; i++) {
      code += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return code
  }

  const generated = new Set<string>()
  const attemptsLimit = count * 100
  let attempts = 0
  while (generated.size < count && attempts < attemptsLimit) {
    attempts++
    const next = makeRandom()
    if (!generated.has(next)) generated.add(next)
  }
  if (generated.size < count) {
    throw new CardCodeGenerateError('可用字符集过小或长度不足，无法生成足够数量的唯一点歌券，请增大字符集或长度')
  }

  return [...generated]
}

/**
 * 生成券码并写入数据库（跳过已存在的券码）。
 *
 * 返回实际写入的券码行，供后续派发使用。
 */
export async function createCardCodes(params: {
  codes: string[]
  note?: string | null
}): Promise<Array<{ id: number; code: string }>> {
  const uniqueCodes = [...new Set(params.codes.map((code) => String(code).trim().toUpperCase()).filter(Boolean))]
  if (!uniqueCodes.length) return []

  const existingRows = await db
    .select({ code: cardCodes.code })
    .from(cardCodes)
    .where(inArray(cardCodes.code, uniqueCodes))
  const existingCodes = new Set(existingRows.map((row) => row.code))
  const insertCodes = uniqueCodes.filter((code) => !existingCodes.has(code))
  if (!insertCodes.length) return []

  const rows = await db
    .insert(cardCodes)
    .values(
      insertCodes.map((code) => ({
        code,
        status: 'AVAILABLE' as const,
        note: params.note || null
      }))
    )
    .onConflictDoNothing({ target: cardCodes.code })
    .returning({ id: cardCodes.id, code: cardCodes.code })

  return rows
}

/**
 * 删除一批券（仅用于生成后未派发成功的清理场景）。
 */
export async function deleteCardCodes(ids: number[]): Promise<void> {
  if (!ids.length) return
  await db.delete(cardCodes).where(and(
    inArray(cardCodes.id, ids), eq(cardCodes.status, 'AVAILABLE'), isNull(cardCodes.assignedTo),
    notExists(db.select({ id: songs.id }).from(songs).where(eq(songs.cardCodeId, cardCodes.id))),
    notExists(db.select({ id: cardCodeAssignments.id }).from(cardCodeAssignments).where(and(
      eq(cardCodeAssignments.cardCodeId, cardCodes.id), eq(cardCodeAssignments.status, 'ASSIGNED')
    )))
  ))
}
