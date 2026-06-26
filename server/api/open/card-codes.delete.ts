import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { deleteCardCodesByIds } from '~~/server/services/cardCodeCleanupService'

const deleteCardCodesSchema = z.object({
  id: z.union([z.number().int().positive(), z.string()]).optional(),
  ids: z.array(z.union([z.number().int().positive(), z.string()])).max(500, '单次最多删除 500 个点歌券').optional()
})

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
    const ids = Array.from(new Set(
      rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    ))

    if (!ids.length) {
      throw createError({ statusCode: 400, message: '缺少有效点歌券ID' })
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
