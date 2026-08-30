import { getTxSongPlayableInfo } from '~~/server/utils/native_tx'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const musicId = String(body?.musicId || '').trim()
  const commentId = String(body?.commentId || '').trim()
  const cookie = String(body?.cookie || '').trim()
  const liked = body?.liked !== false
  if (!musicId || !commentId) throw createError({ statusCode: 400, message: '缺少点赞参数' })
  if (!cookie) throw createError({ statusCode: 401, message: '请先登录 QQ 音乐' })

  const info = await getTxSongPlayableInfo(musicId)
  const response = await $fetch<any>('https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg', {
    params: {
      g_tk: 5381, loginUin: 0, hostUin: 0, format: 'json', inCharset: 'utf8', outCharset: 'utf-8',
      platform: 'yqq.json', needNewCode: 0, cid: 205360772, reqtype: 2, biztype: 1,
      topid: String(info.songId || ''), commentid: commentId, cmd: liked ? 3 : 4, domain: 'qq.com'
    },
    method: 'GET',
    headers: { Cookie: cookie, Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0' },
    responseType: 'json', signal: AbortSignal.timeout(8000)
  })
  if (!response || Number(response.code) !== 0) throw createError({ statusCode: 502, message: 'QQ 音乐评论点赞失败' })
  return { code: 200, data: { liked } }
})
