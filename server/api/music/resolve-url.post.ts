import { upgradeTxAudioUrl } from '~~/server/utils/native_tx'
import {
  getQqCookieDiagnostic,
  normalizeQqCookie,
  refreshQqCredential,
  resolveQqOfficialPlayUrl,
  resolveQqSdkPlayUrl
} from '~~/server/utils/qq_music_sdk'

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
  // official-first：QQ 官方 Cookie 链路；fallback：第三方兜底链路
  const strategy = body?.strategy === 'official-first' ? 'official-first' : 'fallback'
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

  const normalizedMusicId = String(musicId || '').trim()

  // 官方 Cookie 链路：带用户登录态走 CgiGetVkey，可获取 VIP/高音质直链
  if (strategy === 'official-first') {
    if (excludedSources.has('qq-official')) {
      throw createError({ statusCode: 502, message: 'QQ 音乐播放链接解析失败' })
    }

    const mediaId = String(body?.mediaId || '').trim() || undefined

    // SDK 与原生直连互为校验：SDK 依赖上游文件名策略，原生链路可诊断拒绝原因
    const attemptOfficial = async (activeCookie?: string): Promise<string> => {
      try {
        return await resolveQqSdkPlayUrl(normalizedMusicId, body?.quality, activeCookie, mediaId)
      } catch (error: any) {
        const sdkError = error?.message || String(error)
        console.warn('[music/resolve-url] QQ 官方 SDK 解析失败，尝试原生直连:', sdkError)

        try {
          return await resolveQqOfficialPlayUrl({
            songmid: normalizedMusicId,
            quality: body?.quality,
            cookie: activeCookie,
            mediaId
          })
        } catch (nativeError: any) {
          const nativeErrorText = nativeError?.message || String(nativeError)
          console.warn('[music/resolve-url] QQ 原生直连解析失败:', nativeErrorText)
          throw createError({
            statusCode: 502,
            message: `QQ 官方链路解析失败：${sdkError}；原生直连：${nativeErrorText}`
          })
        }
      }
    }

    let activeCookie = cookie || undefined
    try {
      const url = await attemptOfficial(activeCookie)
      return {
        success: true,
        url,
        source: 'qq-official',
        normalizedMusicId,
        idType: 'songmid',
        authUsed: Boolean(activeCookie),
        authDiagnostic: getQqCookieDiagnostic(activeCookie)
      }
    } catch (error) {
      // 登录态过期是解析失败的常见原因，续期成功后重试一轮
      if (!activeCookie) throw error
      const refreshResult = await refreshQqCredential({ cookie: activeCookie })
      if (!refreshResult.refreshed) throw error
      activeCookie = refreshResult.cookie

      const url = await attemptOfficial(activeCookie)
      return {
        success: true,
        url,
        source: 'qq-official',
        normalizedMusicId,
        idType: 'songmid',
        authUsed: true,
        authDiagnostic: getQqCookieDiagnostic(activeCookie),
        cookie: activeCookie
      }
    }
  }

  if (excludedSources.has('hyw-tx')) {
    throw createError({ statusCode: 502, message: 'QQ 音乐播放链接解析失败' })
  }

  try {
    const url = await resolveTxWithHyw(normalizedMusicId, body?.quality)
    return {
      success: true,
      url,
      source: 'hyw-tx',
      normalizedMusicId,
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
