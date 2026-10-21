import { getTxSongPlayableInfo, upgradeTxAudioUrl } from '~~/server/utils/native_tx'
import {
  getQqCookieDiagnostic,
  normalizeQqCookie,
  refreshQqCredential,
  resolveQqOfficialPlayUrl,
  resolveQqSdkPlayUrl
} from '~~/server/utils/qq_music_sdk'

const HYW_TX_URL = 'http://103.79.184.97/api/music/url'
const HYW_CARD_KEY = 'PYPW-QFRL-3DBF-95O6'
const YUAFENG_TX_URL = 'https://api-v2.yuafeng.cn/API/qqmusic.php'
const YUAFENG_TX_APIKEY = '3ff23523e47465224a3f48579acf41f241540ce04b6cc0b94164f37a5b6299d5'
const HELLOWORLD_TX_URL = 'https://a.aa.cab/qq.music'
// QQ 已知无效占位音频，命中说明源返回的是错误录音
const INVALID_QQ_AUDIO_URL_SUFFIX = '/2149972737147268278.mp3'

// 从任意 JSON/文本响应中防御式提取 QQ 音频直链
const extractTxAudioUrl = (payload: unknown): string => {
  let found = ''
  const visit = (node: any) => {
    if (found || !node) return
    if (typeof node === 'string') {
      if (/^https?:\/\//i.test(node) && (/vkey=/i.test(node) || /\.(mp3|flac|m4a|ape|wav)(\?|$)/i.test(node))) {
        found = node.trim()
      }
      return
    }
    if (typeof node === 'object') Object.values(node).forEach(visit)
  }
  visit(payload)
  return found
}

const isValidTxAudioUrl = (url: string) => /^https?:\/\//i.test(url) && !url.includes(INVALID_QQ_AUDIO_URL_SUFFIX)

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

const resolveTxWithYuafeng = async (songmid: string, quality: unknown) => {
  const typeMap: Record<string, string> = {
    '4': '标准',
    '8': '高品质',
    '10': '无损',
    '11': '无损',
    '14': '无损'
  }
  const url = `${YUAFENG_TX_URL}?type=${encodeURIComponent(typeMap[String(quality)] || '标准')}&mid=${encodeURIComponent(songmid)}&apikey=${YUAFENG_TX_APIKEY}`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`玉宁熙返回 ${response.status}`)
  const text = await response.text()
  let payload: any = text
  try { payload = JSON.parse(text) } catch { /* 非 JSON 响应，按原始文本提取 */ }
  const playUrl = extractTxAudioUrl(payload)
  if (!isValidTxAudioUrl(playUrl)) throw new Error('玉宁熙未返回播放链接')
  return upgradeTxAudioUrl(playUrl)
}

const resolveTxWithHelloWorld = async (name: string) => {
  if (!name) throw new Error('HelloWorld 缺少歌曲名')
  const url = `${HELLOWORLD_TX_URL}?msg=${encodeURIComponent(name)}&n=1&type=0`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  if (!response.ok) throw new Error(`HelloWorld 返回 ${response.status}`)
  const text = await response.text()
  let payload: any = text
  try { payload = JSON.parse(text) } catch { /* 非 JSON 响应，按原始文本提取 */ }
  const playUrl = extractTxAudioUrl(payload)
  if (!isValidTxAudioUrl(playUrl)) throw new Error('HelloWorld 未返回播放链接')
  return upgradeTxAudioUrl(playUrl)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const platform = String(body?.platform || '').trim()
  const musicId = body?.musicId
  const playUrl = String(body?.playUrl || '').trim()
  const cookie = normalizeQqCookie(String(body?.cookie || '').trim())
  // official-first：QQ 官方 Cookie 链路；aggregator：内置聚合源兜底链；fallback：第三方兜底链路
  const rawStrategy = String(body?.strategy || '')
  const strategy =
    rawStrategy === 'official-first' ? 'official-first' : rawStrategy === 'aggregator' ? 'aggregator' : 'fallback'
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

  // 官方与第三方取链均要求字母 songmid；历史数字 songId 先解析为 MID，避免原样透传导致取链失败
  let resolvedMusicId = normalizedMusicId
  let resolvedMediaId = String(body?.mediaId || '').trim() || undefined
  if (/^\d+$/.test(normalizedMusicId)) {
    try {
      const playable = await getTxSongPlayableInfo(normalizedMusicId)
      resolvedMusicId = playable.songmid
      if (!resolvedMediaId && playable.strMediaMid) resolvedMediaId = playable.strMediaMid
    } catch (error: any) {
      console.warn('[music/resolve-url] QQ 数字 songId 解析 MID 失败:', error?.message || error)
      throw createError({ statusCode: 502, message: 'QQ 音乐播放链接解析失败' })
    }
  }

  // 聚合源兜底链：玉宁熙（按 mid）→ HelloWorld（按歌名），统一走后端以规避前端 CORS
  if (strategy === 'aggregator') {
    const aggregatorName = String(body?.name || '').trim()
    const attempts: Array<{ id: string; run: () => Promise<string> }> = []
    if (!excludedSources.has('yuafeng-tx')) {
      attempts.push({ id: 'yuafeng-tx', run: () => resolveTxWithYuafeng(resolvedMusicId, body?.quality) })
    }
    if (!excludedSources.has('helloworld-tx') && aggregatorName) {
      attempts.push({ id: 'helloworld-tx', run: () => resolveTxWithHelloWorld(aggregatorName) })
    }

    let lastError = ''
    for (const attempt of attempts) {
      try {
        const url = await attempt.run()
        return {
          success: true,
          url,
          source: attempt.id,
          normalizedMusicId: resolvedMusicId,
          idType: 'songmid',
          authUsed: false,
          authDiagnostic: getQqCookieDiagnostic(cookie)
        }
      } catch (error: any) {
        lastError = error?.message || String(error)
        console.warn(`[music/resolve-url] ${attempt.id} 解析失败:`, lastError)
      }
    }
    throw createError({
      statusCode: 502,
      message: lastError ? `QQ 聚合源解析失败：${lastError}` : 'QQ 聚合源解析失败'
    })
  }

  // 官方 Cookie 链路：带用户登录态走 CgiGetVkey，可获取 VIP/高音质直链
  if (strategy === 'official-first') {
    if (excludedSources.has('qq-official')) {
      throw createError({ statusCode: 502, message: 'QQ 音乐播放链接解析失败' })
    }

    const mediaId = resolvedMediaId

    // SDK 与原生直连互为校验：SDK 依赖上游文件名策略，原生链路可诊断拒绝原因
    const attemptOfficial = async (activeCookie?: string): Promise<string> => {
      try {
        return await resolveQqSdkPlayUrl(resolvedMusicId, body?.quality, activeCookie, mediaId)
      } catch (error: any) {
        const sdkError = error?.message || String(error)
        console.warn('[music/resolve-url] QQ 官方 SDK 解析失败，尝试原生直连:', sdkError)

        try {
          return await resolveQqOfficialPlayUrl({
            songmid: resolvedMusicId,
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
        normalizedMusicId: resolvedMusicId,
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
        normalizedMusicId: resolvedMusicId,
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
    const url = await resolveTxWithHyw(resolvedMusicId, body?.quality)
    return {
      success: true,
      url,
      source: 'hyw-tx',
      normalizedMusicId: resolvedMusicId,
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
