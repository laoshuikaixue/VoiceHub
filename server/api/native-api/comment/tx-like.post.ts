import { getTxSongPlayableInfo } from '~~/server/utils/native_tx'
import { getQqWebSession } from '~~/server/utils/qq_music_sdk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const musicId = String(body?.musicId || '').trim()
  const originalSongId = String(body?.songId || '').trim()
  const commentId = String(body?.commentId || '').trim()
  const cookie = String(body?.cookie || '').trim()
  const liked = body?.liked !== false
  if (!musicId || !commentId) throw createError({ statusCode: 400, message: '缺少点赞参数' })
  if (!cookie) throw createError({ statusCode: 401, message: '请先登录 QQ 音乐' })

  let topid = /^\d+$/.test(originalSongId) ? originalSongId : ''
  if (!topid && /^\d+$/.test(musicId)) topid = musicId
  if (!topid) {
    const info = await getTxSongPlayableInfo(musicId)
    topid = String(info.songId || '').trim()
  }
  if (!topid) throw createError({ statusCode: 502, message: 'QQ 音乐歌曲 ID 无效' })

  const session = getQqWebSession(cookie)
  if (!session.uin) throw createError({ statusCode: 401, message: 'QQ 音乐登录状态无效' })

  const response = await $fetch<any>('https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg', {
    params: {
      g_tk: session.gtk,
      g_tk_new_20200303: session.gtk,
      loginUin: session.uin,
      hostUin: 0,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      platform: 'yqq.json',
      needNewCode: 0,
      cid: 205360772,
      reqtype: 2,
      biztype: 1,
      topid,
      commentid: commentId,
      cmd: liked ? 3 : 4,
      domain: 'qq.com'
    },
    method: 'GET',
    headers: { Cookie: session.cookie, Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0' },
    responseType: 'json',
    signal: AbortSignal.timeout(8000)
  })
  if (!response || Number(response.code) !== 0) {
    throw createError({ statusCode: 502, message: response?.message || 'QQ 音乐评论点赞失败' })
  }
  return { code: 200, data: { liked } }
})
