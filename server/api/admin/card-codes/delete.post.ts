import { readBody } from 'h3'
import { deleteCardCodesByIds } from '~~/server/services/cardCodeDeleteService'
import { requireCardCodeAdministrator } from './_shared'

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
  requireCardCodeAdministrator(event)

  const body = await readBody(event).catch(() => ({})) ?? {}
  const ids = parseIds(body)
  if (!ids.length) {
    throw createError({ statusCode: 400, message: '缺少有效卡密ID' })
  }
  if (ids.length > 500) {
    throw createError({ statusCode: 400, message: '单次最多删除 500 个卡密' })
  }

  const deletedRows = await deleteCardCodesByIds(ids)
  return {
    success: true,
    message: '卡密删除成功',
    data: {
      cardCodes: deletedRows,
      deleted: deletedRows.length,
      requested: ids.length
    }
  }
})