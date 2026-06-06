import {
  getTxSongPlayableInfo,
  normalizeTxMusicId,
  upgradeTxAudioUrl
} from '~~/server/utils/native_tx'

const TX_MUSICU_FALLBACK_QUALITY = 8
const TX_DISABLED_EXPERIMENTAL_SOURCES = ['grass', 'flower']

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

const normalizeVkeysQuality = (quality: unknown) => {
  const numericQuality = Number(quality)
  return Number.isNaN(numericQuality) ? TX_MUSICU_FALLBACK_QUALITY : numericQuality
}

const resolveTxWithDreamMeting = async (songmid: string) => {
  const url = `https://music.3e0.cn/?server=tencent&type=url&id=${encodeURIComponent(songmid)}`
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  const location = response.headers.get('location')
  if (location) {
    return upgradeTxAudioUrl(location)
  }

  if (response.redirected && response.url) {
    return upgradeTxAudioUrl(response.url)
  }

  throw new Error(`music.3e0.cn 未返回播放重定向(${response.status})`)
}

const resolveTxWithHuibq = async (songmid: string, quality: string) => {
  const url = `https://lxmusicapi.onrender.com/url/tx/${encodeURIComponent(songmid)}/${encodeURIComponent(quality)}`
  const response = await fetch(url, {
    headers: {
      'X-Request-Key': 'share-v3',
      'User-Agent': 'lx-music-desktop/2.11.0'
    }
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

const resolveTxWithVkeys = async (musicId: string, quality: number) => {
  const url = `https://api.vkeys.cn/v2/music/tencent?id=${encodeURIComponent(musicId)}&quality=${quality}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`vkeys 返回 ${response.status}`)
  }

  const data: any = await response.json()
  if (data?.code !== 200 || !data?.data?.url) {
    throw new Error(data?.message || data?.msg || 'vkeys 未返回播放链接')
  }

  return upgradeTxAudioUrl(data.data.url)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const platform = String(body?.platform || '').trim()
  const musicId = body?.musicId
  const playUrl = String(body?.playUrl || '').trim()

  if (playUrl) {
    return {
      success: true,
      url: platform === 'tencent' ? upgradeTxAudioUrl(playUrl) : playUrl,
      source: 'play-url',
      normalizedMusicId: musicId ? String(musicId).trim() : '',
      idType: 'provided-url'
    }
  }

  if (platform !== 'tencent') {
    throw createError({ statusCode: 400, message: '暂不支持的平台' })
  }

  const normalized = normalizeTxMusicId(musicId)
  const playableInfo = await getTxSongPlayableInfo(musicId)
  const huibqQuality = normalizeTxQuality(body?.quality)
  const vkeysQuality = normalizeVkeysQuality(body?.quality)
  const errors: string[] = []

  try {
    const url = await resolveTxWithDreamMeting(playableInfo.songmid)
    return {
      success: true,
      url,
      source: 'music.3e0.cn',
      normalizedMusicId: playableInfo.songmid,
      idType: normalized.idType
    }
  } catch (error: any) {
    errors.push(`music.3e0.cn: ${error?.message || error}`)
  }

  try {
    const url = await resolveTxWithHuibq(playableInfo.songmid, huibqQuality)
    return {
      success: true,
      url,
      source: 'huibq',
      normalizedMusicId: playableInfo.songmid,
      idType: normalized.idType
    }
  } catch (error: any) {
    errors.push(`huibq: ${error?.message || error}`)
  }

  try {
    const url = await resolveTxWithVkeys(playableInfo.songId || playableInfo.songmid, vkeysQuality)
    return {
      success: true,
      url,
      source: 'vkeys',
      normalizedMusicId: playableInfo.songmid,
      idType: normalized.idType
    }
  } catch (error: any) {
    errors.push(`vkeys: ${error?.message || error}`)
  }

  throw createError({
    statusCode: 502,
    message: `QQ 音乐播放链接解析失败：${errors.join('；')}（实验源 ${TX_DISABLED_EXPERIMENTAL_SOURCES.join('/')} 默认禁用）`
  })
})
