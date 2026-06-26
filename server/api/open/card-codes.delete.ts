import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { deleteCardCodesByIds } from '~~/server/services/cardCodeCleanupService'

const deleteCardCodesSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  ids: z.array(z.coerce.number().int().positive()).max(500, '单次最多删除 500 个点歌券').optional()
})

const MAX_DELETE_COUNT = 500

export default defineEventHandler(async (event) => {
  const apiKey = event.context.apiKey
  if (!apiKey) {
    throw createError({ statusCode: 401, message: 'API认证失败' })
  }

  try {
    const body = await readBody(event) ?? {}
    const validatedData = deleteCardCodesSchema.parse(body)
    const rawIds = [
      ...(validatedData.id !== undefined ? [validatedData.id] : []),
      ...(validatedData.ids || [])
    ]
    const ids = Array.from(new Set(rawIds))

    if (!ids.length) {
      throw createError({ statusCode: 400, message: '缺少有效点歌券ID' })
    }
    if (ids.length > MAX_DELETE_COUNT) {
      throw createError({ statusCode: 400, message: `单次最多删除 ${MAX_DELETE_COUNT} 个点歌券` })
    }

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
    if (err.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: `请求参数验证失败：${(err.issues || err.errors).map((issue: any) => issue.message).join(', ')}`
      })
    }
    console.error('开放API删除点歌券失败', err)
    throw createError({ statusCode: 500, message: '删除点歌券失败' })
  }
})
