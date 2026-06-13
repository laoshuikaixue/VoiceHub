import { db } from '~/drizzle/db'
import { cardCodes } from '~/drizzle/schema'
import { and, desc, eq, ilike, or, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  try {
    const query = getQuery(event)
    const idsParam = typeof query.ids === 'string' ? query.ids.trim() : ''
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : ''
    const keyword = typeof query.q === 'string' ? query.q.trim() : ''

    const conditions: any[] = []
    if (status) conditions.push(eq(cardCodes.status, status as any))
    if (keyword) {
      conditions.push(
        or(
          ilike(cardCodes.code, `%${keyword}%`),
          ilike(cardCodes.note, `%${keyword}%`)
        )
      )
    }

    let rows
    if (idsParam) {
      const ids = idsParam.split(',').map((s) => Number(s)).filter(Boolean)
      rows = await db.select().from(cardCodes).where(inArray(cardCodes.id, ids)).orderBy(desc(cardCodes.createdAt))
    } else {
      let qb = db.select().from(cardCodes)
      if (conditions.length) qb = qb.where(and(...conditions))
      rows = await qb.orderBy(desc(cardCodes.createdAt))
    }

    // Build CSV
    const header = ['id', 'code', 'status', 'lockedBy', 'lockedAt', 'redeemedBy', 'redeemedAt', 'note', 'createdAt']
    const csvRows = [header.join(',')]
    for (const r of rows) {
      const esc = (v: any) => {
        if (v === null || typeof v === 'undefined') return ''
        const s = String(v)
        return s.includes(',') || s.includes('\n') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      csvRows.push([
        esc(r.id),
        esc(r.code),
        esc(r.status),
        esc(r.lockedBy),
        esc(r.lockedAt),
        esc(r.redeemedBy),
        esc(r.redeemedAt),
        esc(r.note),
        esc(r.createdAt)
      ].join(','))
    }

    const csv = '\ufeff' + csvRows.join('\n')

    // set headers and return raw csv
    const res = event.node.res
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="card-codes.csv"')
    return csv
  } catch (err) {
    console.error('导出点歌券失败', err)
    throw createError({ statusCode: 500, message: '导出点歌券失败' })
  }
})
