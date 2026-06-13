import { getQqUserAvatar } from '~~/server/utils/qq_music_sdk'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const uin = String(query.uin || '').trim()
  const k = String(query.k || '').trim()
  const size = Number(query.size || 140)

  if (!uin && !k) {
    throw createError({ statusCode: 400, message: '缺少 uin 或 k 参数' })
  }

  if (!Number.isFinite(size) || size <= 0) {
    throw createError({ statusCode: 400, message: 'size 参数无效' })
  }

  try {
    return {
      success: true,
      data: await getQqUserAvatar({
        uin: uin || undefined,
        k: k || undefined,
        size
      })
    }
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      message: error?.message || '获取 QQ 用户头像失败'
    })
  }
})
