import { resolveQqSdkLyric } from '~~/server/utils/qq_music_sdk'

const fetchLegacyTxLyric = async (songmid: string, songid: string) => {
  const params = new URLSearchParams()
  params.append('format', 'json')
  params.append('outCharset', 'utf-8')
  params.append('pcachetime', String(Date.now()))
  params.append('loginUin', '0')
  if (songmid) params.append('songmid', songmid)
  if (songid) params.append('songid', songid)

  const response = await fetch(
    `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${params.toString()}`,
    {
      headers: {
        Referer: 'https://y.qq.com/portal/player.html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      signal: AbortSignal.timeout(8000)
    }
  )

  if (!response.ok) {
    throw createError({ statusCode: 502, message: `QQ 歌词接口返回 ${response.status}` })
  }

  const text = await response.text()
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    const jsonStr = text.replace(/^\w+\(/, '').replace(/\)\s*$/, '')
    data = JSON.parse(jsonStr)
  }
  if (!data || data.code !== 0) {
    throw createError({ statusCode: 502, message: `QQ 歌词接口异常: ${data?.code ?? '未知'}` })
  }

  const decodeField = (value: unknown): string => {
    if (typeof value !== 'string' || !value) return ''
    try {
      const decoded = Buffer.from(value, 'base64').toString()
      return decoded || value
    } catch {
      return value
    }
  }

  return {
    lrc: decodeField(data.lyric),
    trans: decodeField(data.trans)
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const songmid = (query.songmid as string) || ''
  const songid = (query.songid as string) || ''
  const cookie = (query.cookie as string) || ''

  if (!songmid && !songid) {
    throw createError({ statusCode: 400, message: '缺少 songmid 或 songid 参数' })
  }

  try {
    let data
    try {
      data = await resolveQqSdkLyric({ songmid, songid, cookie })
    } catch (sdkError) {
      console.warn('[tx.lyric] qq-music-api 歌词接口失败，回退到旧接口:', sdkError)
      data = await fetchLegacyTxLyric(songmid, songid)
    }

    return {
      success: true,
      data
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[tx.lyric] 获取歌词失败:', err)
    throw createError({ statusCode: 500, message: 'Internal Server Error' })
  }
})
