import {
  getTxSongPlayableInfo,
  normalizeTxMusicId,
  upgradeTxAudioUrl
} from '~~/server/utils/native_tx'
import {
  getQqCookieDiagnostic,
  normalizeQqCookie
} from '~~/server/utils/qq_music_sdk'

const TX_MUSICU_FALLBACK_QUALITY = 8
const TX_DISABLED_EXPERIMENTAL_SOURCES = ['grass', 'flower']
const INVALID_TX_AUDIO_URLS = [
  'https://panspace.kuwo.cn/2b7877721f6efffecd4abe8359325f29/6a2d0b00/resource/2149972737147268278.mp3'
]

const txQualityMap: Record<string, string> = {
  '4': '128k',
  '8': '320k',
  '10': 'flac',
  '11': 'flac24bit',
  '14': 'flac24bit',
  '128': '128k',
  '320': '320k',
  '128k': '128k',
  '320k': '320k',
  flac: 'flac',
  sq: 'flac',
  hires: 'flac24bit',
  flac24bit: 'flac24bit'
}

const normalizeTxQuality = (quality: unknown) => {
  const key = String(quality ?? TX_MUSICU_FALLBACK_QUALITY).toLowerCase()
  return txQualityMap[key] || '320k'
}

const resolveTxWithDreamMeting = async (songmid: string) => {
  const url = `https://music.3e0.cn/?server=tencent&type=url&id=${encodeURIComponent(songmid)}`
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    signal: AbortSignal.timeout(5000)
  })

  const location = response.headers.get('location')
  if (location) {
    return upgradeTxAudioUrl(location)
  }

  throw new Error(`music.3e0.cn 未返回播放重定向(${response.status})`)
}

const resolveTxWithHuibq = async (songmid: string, quality: string) => {
  const url = `https://lxmusicapi.onrender.com/url/tx/${encodeURIComponent(songmid)}/${encodeURIComponent(quality)}`
  const response = await fetch(url, {
    headers: {
      'X-Request-Key': 'share-v3',
      'User-Agent': 'lx-music-desktop/2.11.0'
    },
    signal: AbortSignal.timeout(5000)
  })

  if (!response.ok) {
    throw new Error(`Huibq 返回 ${response.status}`)
  }

  const data: any = await response.json()
  if (data?.code !== 0 || !data?.url) {
    throw new Error(data?.msg || data?.message || 'Huibq 未返回播放链接')
  }

  return upgradeTxAudioUrl(data.url)
}

const validateResolvedTxUrl = (url: string, source: string) => {
  const normalizedUrl = upgradeTxAudioUrl(url.trim())
  if (INVALID_TX_AUDIO_URLS.includes(normalizedUrl)) {
    throw new Error(`${source} 返回已知无效音频链接`)
  }

  return normalizedUrl
}

const normalizeExcludedSources = (value: unknown) => {
  if (!Array.isArray(value)) return new Set<string>()
  return new Set(value.map((item) => String(item || '').trim()).filter(Boolean))
}

const buildResolveMeta = (
  cookie: string,
  attempts: Array<{ source: string; status: string; error?: string }>,
  mediaId?: string
) => ({
  authUsed: Boolean(cookie),
  authDiagnostic: getQqCookieDiagnostic(cookie),
  resolvedMediaId: mediaId || undefined,
  attempts
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const platform = String(body?.platform || '').trim()
  const musicId = body?.musicId
  const playUrl = String(body?.playUrl || '').trim()
  const cookie = normalizeQqCookie(String(body?.cookie || '').trim())
  const excludedSources = normalizeExcludedSources(body?.excludeSources)

  if (playUrl) {
    return {
      success: true,
      url: platform === 'tencent' ? upgradeTxAudioUrl(playUrl) : playUrl,
      source: 'play-url',
      normalizedMusicId: musicId ? String(musicId).trim() : '',
      idType: 'provided-url',
      authUsed: Boolean(cookie),
      authDiagnostic: getQqCookieDiagnostic(cookie),
      attempts: [{ source: 'play-url', status: 'success' }]
    }
  }

  if (platform !== 'tencent') {
    throw createError({ statusCode: 400, message: '暂不支持的平台' })
  }

  const normalized = normalizeTxMusicId(musicId)
  const playableInfo = await getTxSongPlayableInfo(musicId)
  const mediaId = String(
    body?.mediaId ||
      body?.strMediaMid ||
      playableInfo.strMediaMid ||
      ''
  ).trim() || undefined
  const huibqQuality = normalizeTxQuality(body?.quality)
  const errors: string[] = []
  const attempts: Array<{ source: string; status: string; error?: string }> = []
  const tryResolvers = ['huibq', 'music.3e0.cn']

  for (const source of tryResolvers) {
    if (excludedSources.has(source)) {
      errors.push(`${source}: 已跳过失败源`)
      attempts.push({ source, status: 'skipped' })
      continue
    }

    try {
      if (source === 'huibq') {
        const url = validateResolvedTxUrl(
          await resolveTxWithHuibq(playableInfo.songmid, huibqQuality),
          source
        )
        return {
          success: true,
          url,
          source,
          normalizedMusicId: playableInfo.songmid,
          idType: normalized.idType,
          ...buildResolveMeta(cookie, [...attempts, { source, status: 'success' }], mediaId)
        }
      }

      const url = validateResolvedTxUrl(
        await resolveTxWithDreamMeting(playableInfo.songmid),
        source
      )
      return {
        success: true,
        url,
        source,
        normalizedMusicId: playableInfo.songmid,
        idType: normalized.idType,
        ...buildResolveMeta(cookie, [...attempts, { source, status: 'success' }], mediaId)
      }
    } catch (error: any) {
      const message = String(error?.message || error)
      errors.push(`${source}: ${message}`)
      attempts.push({ source, status: 'error', error: message })
    }
  }

  throw createError({
    statusCode: 502,
    message: `QQ 音乐播放链接解析失败：${errors.join('；')}（实验源 ${TX_DISABLED_EXPERIMENTAL_SOURCES.join('/')} 默认禁用）`
  })
})
