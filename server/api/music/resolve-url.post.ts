import { upgradeTxAudioUrl } from '~~/server/utils/native_tx'
import { getQqCookieDiagnostic, normalizeQqCookie } from '~~/server/utils/qq_music_sdk'

const HYW_TX_URL = 'http://103.79.184.97/api/music/url'
const HYW_CARD_KEY = 'PYPW-QFRL-3DBF-95O6'

const resolveTxWithHyw = async (songmid: string, quality: unknown) => {
  const qualityMap: Record<string, string> = {
    '4': '128k',
    '8': '320k',
    '10': 'flac',
    '11': 'master',
    '14': 'master'
  }
  const query = new URLSearchParams({
    source: 'tx',
    songId: songmid,
    songmid,
    platform: 'tx',
    quality: qualityMap[String(quality)] || String(quality || '128k'),
    key: HYW_CARD_KEY
  })
  const response = await fetch(`${HYW_TX_URL}?${query.toString()}`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json', 'X-Card-Key': HYW_CARD_KEY }
  })
  if (!response.ok) throw new Error(`HYW 返回 ${response.status}`)
  const data: any = await response.json()
  const url = typeof data?.url === 'string' ? data.url.trim() : ''
  if (data?.code !== 200 || !/^https?:\/\//i.test(url)) {
    throw new Error(data?.message || 'HYW 未返回播放链接')
  }
  return upgradeTxAudioUrl(url)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const platform = String(body?.platform || '').trim()
  const musicId = body?.musicId
  const playUrl = String(body?.playUrl || '').trim()
  const cookie = normalizeQqCookie(String(body?.cookie || '').trim())
  const excludedSources = new Set(
    Array.isArray(body?.excludeSources)
      ? body.excludeSources.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : []
  )

  if (playUrl) {
    return {
      success: true,
      url: platform === 'tencent' ? upgradeTxAudioUrl(playUrl) : playUrl,
      source: 'play-url',
      normalizedMusicId: musicId ? String(musicId).trim() : '',
      idType: 'provided-url',
      authUsed: Boolean(cookie),
      authDiagnostic: getQqCookieDiagnostic(cookie)
    }
  }

  if (platform !== 'tencent') {
    throw createError({ statusCode: 400, message: '暂不支持的平台' })
  }

  if (excludedSources.has('hyw-tx')) {
    throw createError({ statusCode: 502, message: 'QQ 音乐播放链接解析失败' })
  }

  try {
    const url = await resolveTxWithHyw(String(musicId || '').trim(), body?.quality)
    return {
      success: true,
      url,
      source: 'hyw-tx',
      normalizedMusicId: String(musicId || '').trim(),
      idType: 'songmid',
      authUsed: Boolean(cookie),
      authDiagnostic: getQqCookieDiagnostic(cookie)
    }
  } catch (error: any) {
    console.warn('[music/resolve-url] HYW QQ 回退失败:', error?.message || error)
  }

  throw createError({
    statusCode: 502,
    message: 'QQ 音乐播放链接解析失败'
  })
})
