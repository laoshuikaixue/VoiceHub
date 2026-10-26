import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { asc, inArray } from 'drizzle-orm'
import { getServerDate } from '~~/server/utils/serverTime'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

/** 标签名长度上限 */
const MAX_TAG_LENGTH = 20
/** 单个用户最多拥有的标签数 */
const MAX_TAGS_PER_USER = 10
/** 单次操作可影响的用户数上限 */
const MAX_USER_COUNT = 500

/** 规范化标签名：去空白、去重、限制长度与数量 */
const normalizeTags = (input: unknown): string[] => {
  if (!Array.isArray(input)) return []
  const result: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (!name || name.length > MAX_TAG_LENGTH) continue
    if (!result.includes(name)) result.push(name)
  }
  return result.slice(0, MAX_TAGS_PER_USER)
}

/**
 * 批量给用户添加/移除标签。
 *
 * body: { userIds: number[], add?: string[], remove?: string[] }
 * add 与 remove 可同时使用；单个用户标签数超限时跳过该用户的添加并记录原因。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED, '未授权访问')
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INSUFFICIENT_PERMISSION, '权限不足')
  }

  const body = (await readBody(event)) || {}

  const rawUserIds: unknown[] = Array.isArray(body.userIds) ? (body.userIds as unknown[]) : []
  const userIds: number[] = [
    ...new Set(
      rawUserIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ]
  if (!userIds.length) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请选择要打标签的用户')
  }
  if (userIds.length > MAX_USER_COUNT) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '操作用户数超过上限')
  }

  const add = normalizeTags(body.add)
  const remove = normalizeTags(body.remove)
  if (!add.length && !remove.length) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请指定要添加或移除的标签')
  }

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select({ id: users.id, tags: users.tags })
      .from(users)
      .where(inArray(users.id, userIds))
      .orderBy(asc(users.id))
      .for('update')
    const existingMap = new Map(existingRows.map((row) => [row.id, row.tags || []]))

    const missingIds = userIds.filter((id) => !existingMap.has(id))

    // 逐人计算目标标签集合，超限与无变化的用户明确记录，不静默跳过
    const updates: Array<{ id: number; tags: string[] }> = []
    const skipped: Array<{ userId: number; reason: string }> = []
    for (const id of userIds) {
      const current = existingMap.get(id)
      if (!current) continue
      let next = current.filter((tag) => !remove.includes(tag))
      for (const tag of add) {
        if (!next.includes(tag)) next.push(tag)
      }
      if (next.length > MAX_TAGS_PER_USER) {
        skipped.push({ userId: id, reason: `标签数量超过 ${MAX_TAGS_PER_USER} 个上限` })
        continue
      }
      if (next.length === current.length && next.every((tag, index) => tag === current[index])) {
        skipped.push({ userId: id, reason: '标签无变化' })
        continue
      }
      updates.push({ id, tags: next })
    }

    let updatedCount = 0
    if (updates.length) {
      // 按目标标签集合分组批量更新，减少查询次数
      const groups = new Map<string, number[]>()
      for (const item of updates) {
        const key = JSON.stringify(item.tags)
        const list = groups.get(key) || []
        list.push(item.id)
        groups.set(key, list)
      }
      for (const [key, ids] of groups) {
        await tx
          .update(users)
          .set({ tags: JSON.parse(key), updatedAt: getServerDate() })
          .where(inArray(users.id, ids))
        updatedCount += ids.length
      }
    }

    return {
      success: true,
      updatedCount,
      skipped,
      missingIds
    }
  })
})
