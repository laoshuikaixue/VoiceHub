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
      const ids = idsParam.split(',').map((s) => Number(s)).filter((id) => Number.isInteger(id) && id > 0)
      if (ids.length === 0) {
        throw createError({ statusCode: 400, message: '无效的点歌券ID' })
      }
      rows = await db.select().from(cardCodes).where(inArray(cardCodes.id, ids)).orderBy(desc(cardCodes.createdAt))
    } else {
      let qb = db.select().from(cardCodes)
      if (conditions.length) qb = qb.where(and(...conditions))
      rows = await qb.orderBy(desc(cardCodes.createdAt))
    }

    const statusLabelMap: Record<string, string> = {
      AVAILABLE: '可用',
      LOCKED: '已锁定',
      REDEEMED: '已核销',
      INVALID: '已作废'
    }
    const header = ['ID', '点歌券', '状态', '备注', '创建时间', '更新时间', '锁定用户ID', '锁定时间', '核销用户ID', '核销时间']
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
        esc(statusLabelMap[r.status] || r.status),
        esc(r.note),
        esc(r.createdAt),
        esc(r.updatedAt),
        esc(r.lockedBy),
        esc(r.lockedAt),
        esc(r.redeemedBy),
        esc(r.redeemedAt)
      ].join(','))
    }

    const csv = '\ufeff' + csvRows.join('\n')

    const res = event.node.res
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="card-codes.csv"')
    return csv
  } catch (err: any) {
    console.error('导出点歌券失败', err)
    throw createError({ statusCode: err.statusCode || 500, message: err.message || '导出点歌券失败' })
  }
})
