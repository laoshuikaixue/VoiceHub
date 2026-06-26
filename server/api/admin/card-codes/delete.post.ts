import { createError, defineEventHandler, readBody } from 'h3'
import { deleteCardCodesByIds } from '~~/server/services/cardCodeDeleteService'

const parseIds = (body: any): number[] => {
  const rawIds = Array.isArray(body?.ids) ? body.ids : body?.id !== undefined ? [body.id] : []
  return Array.from(new Set(
    rawIds
      .filter((id: any) => (typeof id === 'number' || typeof id === 'string') && id !== '')
      .map((id: any) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id > 0)
  ))
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }

  const body = await readBody(event).catch(() => ({})) ?? {}
  const ids = parseIds(body)
  if (!ids.length) {
    throw createError({ statusCode: 400, message: '缺少有效点歌券ID' })
  }
  if (ids.length > 500) {
    throw createError({ statusCode: 400, message: '单次最多删除 500 个点歌券' })
  }

  try {
    const deletedRows = await deleteCardCodesByIds(ids)
    return {
      success: true,
      message: '点歌券删除成功',
      data: {
        cardCodes: deletedRows,
        deleted: deletedRows.length,
        requested: ids.length
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('删除点歌券失败', err)
    throw createError({ statusCode: 500, message: '删除点歌券失败' })
  }
})
