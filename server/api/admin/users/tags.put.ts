import { db } from '~/drizzle/db'
import { sql } from 'drizzle-orm'

const MAX_TAG_LENGTH = 20

/**
 * 全局重命名标签：把所有用户身上的旧标签名替换为新名字。
 * body: { from: string, to: string }
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const body = (await readBody(event)) || {}
  const from = typeof body.from === 'string' ? body.from.trim() : ''
  const to = typeof body.to === 'string' ? body.to.trim() : ''

  if (!from || !to) {
    throw createError({ statusCode: 400, message: '请填写原标签名与新标签名' })
  }
  if (from.length > MAX_TAG_LENGTH || to.length > MAX_TAG_LENGTH) {
    throw createError({ statusCode: 400, message: `标签名长度不能超过 ${MAX_TAG_LENGTH} 个字符` })
  }
  if (from === to) {
    throw createError({ statusCode: 400, message: '新标签名与原标签名相同' })
  }

  // 替换后去重，避免用户已拥有目标标签时出现重复项
  const result = await db.execute(sql`
    UPDATE "User"
    SET tags = ARRAY(
      SELECT DISTINCT t FROM unnest(array_replace(tags, ${from}, ${to})) AS t
      WHERE t IS NOT NULL AND t <> ''
    ),
    "updatedAt" = now()
    WHERE ${from} = ANY(tags)
  `)

  return {
    success: true,
    updatedCount: Number((result as any)?.count ?? (result as any)?.rowCount ?? 0)
  }
})
