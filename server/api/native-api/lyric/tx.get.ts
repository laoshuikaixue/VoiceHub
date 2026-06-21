import { resolveQqNativeLyric, resolveQqSdkLyric } from '~~/server/utils/qq_music_sdk'
import { getTxSongPlayableInfo } from '~~/server/utils/native_tx'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const songmid = (query.songmid as string) || ''
  const songid = (query.songid as string) || ''
  const cookie = (query.cookie as string) || ''
  const name = (query.name as string) || ''
  const artist = (query.artist as string) || ''
  const album = (query.album as string) || ''
  const duration = Number(query.duration) || 0

  if (!songmid && !songid) {
    throw createError({ statusCode: 400, message: '缺少 songmid 或 songid 参数' })
  }

  let resolvedSongId: string = songid
  let resolvedSongmid: string = songmid

  // mid → 数字 songId（原生 QRC 接口必须用数字 ID）
  if (!resolvedSongId && resolvedSongmid) {
    try {
      const info = await getTxSongPlayableInfo(resolvedSongmid)
      resolvedSongId = info.songId || ''
      resolvedSongmid = info.songmid || resolvedSongmid
    } catch (e) {
      console.warn('[tx.lyric] 无法解析 songId，将回退到 SDK 接口:', e)
    }
  }

  // 优先：原生 GetPlayLyricInfo 接口，支持 QRC 逐字歌词
  if (resolvedSongId) {
    try {
      const data = await resolveQqNativeLyric({
        songId: resolvedSongId,
        name,
        artist,
        album,
        duration,
        cookie
      })
      if (data.qrc || data.lrc) {
        return {
          success: true,
          data: {
            lrc: data.lrc || '',
            qrc: data.qrc || '',
            trans: data.trans || '',
            roma: data.roma || ''
          }
        }
      }
    } catch (e) {
      console.warn('[tx.lyric] 原生 QRC 接口失败，回退到 SDK 接口:', e)
    }
  }

  // 回退：qq-music-api SDK（只返回 LRC）
  try {
    const data = await resolveQqSdkLyric({ songmid: resolvedSongmid, songid: resolvedSongId, cookie })
    return {
      success: true,
      data: {
        lrc: data.lrc || '',
        trans: data.trans || ''
      }
    }
  } catch (sdkErr) {
    console.warn('[tx.lyric] SDK 接口失败，回退到旧接口:', sdkErr)
  }

  // 最终回退：旧版 fcg_query_lyric_new 接口
  const params = new URLSearchParams({
    format: 'json',
    outCharset: 'utf-8',
    pcachetime: String(Date.now()),
    loginUin: '0',
    ...(resolvedSongmid ? { songmid: resolvedSongmid } : {}),
    ...(resolvedSongId ? { songid: resolvedSongId } : {})
  })

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
  let legacyData: any
  try {
    legacyData = JSON.parse(text)
  } catch {
    legacyData = JSON.parse(text.replace(/^\w+\(/, '').replace(/\)\s*$/, ''))
  }

  if (!legacyData || legacyData.code !== 0) {
    throw createError({ statusCode: 502, message: `QQ 歌词接口异常: ${legacyData?.code ?? '未知'}` })
  }

  const decodeBase64 = (value: unknown): string => {
    if (typeof value !== 'string' || !value) return ''
    try { return Buffer.from(value, 'base64').toString() || value } catch { return value }
  }

  return {
    success: true,
    data: {
      lrc: decodeBase64(legacyData.lyric),
      trans: decodeBase64(legacyData.trans)
    }
  }
})
