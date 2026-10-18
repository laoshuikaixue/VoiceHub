import { getTxSongPlayableInfo } from '~~/server/utils/native_tx'

// QQ 数字 songId → 字母 songmid，供水端直连的第三方音源（ygking 等）复用；已是 mid 则原样返回
export default defineEventHandler(async (event) => {
  const musicId = String(getQuery(event)?.musicId || '').trim()
  if (!musicId) {
    throw createError({ statusCode: 400, message: '缺少 musicId 参数' })
  }

  // 非纯数字即视为已是 songmid，直接回传，避免无谓的详情接口调用
  if (!/^\d+$/.test(musicId)) {
    return { success: true, musicId, idType: 'mid' }
  }

  try {
    const playable = await getTxSongPlayableInfo(musicId)
    return { success: true, musicId: playable.songmid, songId: playable.songId, idType: 'mid' }
  } catch (error: any) {
    console.warn('[qq/resolve-mid] QQ songId 解析 MID 失败:', error?.message || error)
    throw createError({ statusCode: 502, message: error?.message || 'QQ 音乐 MID 解析失败' })
  }
})
