import {
  getTxSongPlayableInfo,
  normalizeTxMusicId,
  upgradeTxAudioUrl
} from '~~/server/utils/native_tx'
import {
  getQqCookieDiagnostic,
  normalizeQqCookie
} from '~~/server/utils/qq_music_sdk'
import { recordDependencyCall } from '~~/server/utils/operations-metrics'
import { getServerTimestamp } from '~~/server/utils/serverTime'

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

  const startedAt = getServerTimestamp()

  const normalized = normalizeTxMusicId(musicId)
  let playableInfo: Awaited<ReturnType<typeof getTxSongPlayableInfo>>
  try {
    playableInfo = await getTxSongPlayableInfo(musicId)
  } catch (error: any) {
    recordDependencyCall('tencent', {
      success: false,
      semanticFailure: true,
      durationMs: getServerTimestamp() - startedAt,
      error: error?.message || String(error)
    })
    throw error
  }
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
        recordDependencyCall('tencent', {
          success: true,
          durationMs: getServerTimestamp() - startedAt,
          retries: attempts.filter((item) => item.status === 'error').length,
          fallbacks: attempts.filter((item) => item.status === 'error').length
        })
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
      recordDependencyCall('tencent', {
        success: true,
        durationMs: getServerTimestamp() - startedAt,
        retries: attempts.filter((item) => item.status === 'error').length,
        fallbacks: attempts.filter((item) => item.status === 'error').length
      })
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
  if (!excludedSources.has('hyw-tx')) {
    try {
      const url = validateResolvedTxUrl(
        await resolveTxWithHyw(playableInfo.songmid, body?.quality),
        'hyw-tx'
      )
      recordDependencyCall('tencent', {
        success: true,
        durationMs: getServerTimestamp() - startedAt,
        retries: attempts.filter((item) => item.status === 'error').length,
        fallbacks: attempts.filter((item) => item.status === 'error').length
      })
      return {
        success: true,
        url,
        source: 'hyw-tx',
        normalizedMusicId: playableInfo.songmid,
        idType: normalized.idType,
        ...buildResolveMeta(cookie, [...attempts, { source: 'hyw-tx', status: 'success' }], mediaId)
      }
    } catch (error: any) {
      const message = String(error?.message || error)
      errors.push(`hyw-tx: ${message}`)
      attempts.push({ source: 'hyw-tx', status: 'error', error: message })
    }
  } else {
    attempts.push({ source: 'hyw-tx', status: 'skipped' })
  }

  recordDependencyCall('tencent', {
    success: false,
    semanticFailure: true,
    durationMs: getServerTimestamp() - startedAt,
    retries: attempts.filter((item) => item.status === 'error').length,
    fallbacks: attempts.filter((item) => item.status === 'error').length,
    error: errors.join('; ')
  })
  throw createError({
    statusCode: 502,
    message: 'QQ 音乐播放链接解析失败'
  })
})
