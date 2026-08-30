import { useAudioQuality } from '~/composables/useAudioQuality'
import { useMusicSources } from '~/composables/useMusicSources'
import { getVkeysIdParam } from '~/utils/musicSources'
import { parseBilibiliId } from '~/utils/bilibiliSource'

/**
 * 动态获取音乐播放URL
 * @param platform 音乐平台 ('netease' | 'tencent')
 * @param musicId 音乐ID
 * @param playUrl 用户提供的播放链接（可选）
 * @param options 额外选项，例如 { unblock: boolean, quality: number }
 * @returns Promise<string | null> 返回播放URL或null
 */
export type MusicUrlResolveOptions = {
  unblock?: boolean
  quality?: number | string
  mediaId?: string
  excludeSources?: string[]
  ignoreProvidedUrl?: boolean
  musicInfo?: MusicTrackMeta
}

/**
 * 歌曲元信息
 */
export type MusicTrackMeta = {
  name?: string
  artist?: string
  album?: string
}

export type MusicUrlResolveResult = {
  url: string | null
  source?: string
  normalizedMusicId?: string
  idType?: string
}

export const INVALID_QQ_AUDIO_URL_SUFFIX = '/2149972737147268278.mp3'

// 星海音源（咪咕备用通道）：由国内服务器代理获取链接，规避咪咕对海外 IP 的屏蔽
const XINGHAI_BASE_URL = 'https://yy.zddyr.top/lx/api/'
// 星海播放链接缓存（10 分钟），规避星海后端每分钟 10 次的限流
const XINGHAI_CACHE_TTL = 10 * 60 * 1000
// 星海请求滑动窗口限流（60 秒内最多 8 次，留余量规避后端 10 次/分钟限制）
const XINGHAI_RATE_LIMIT_MAX = 8
const XINGHAI_RATE_LIMIT_WINDOW = 60 * 1000
const xinghaiUrlCache = new Map<string, { url: string; expireAt: number }>()
// 同 key 请求合并，避免并发重复请求
const xinghaiInflight = new Map<string, Promise<string | null>>()
// 最近请求时间戳（滑动窗口限流）
const xinghaiRequestTimes: number[] = []

/**
 * 通过星海音源获取咪咕播放链接
 */
const miguQuality = {
  // 音质数值 → 服务端 toneFlag 映射
  flagMap: { 1: 'PQ', 2: 'HQ', 3: 'SQ', 4: 'ZQ24' } as Record<number, string>,
  upgradeUrl(url: string, flag: number) {
    url = decodeURIComponent(url)
    switch (flag) {
      case 2: //HQ
        return url.replace('MP3_128_16_Stero', 'MP3_320_16_Stero')
      case 3: //SQ
        return url.replace('标清高清/MP3_128_16_Stero', '歌曲下载/flac').replace('.mp3', '.flac')
      case 4: //ZQ24 / ZQ
        return url
          .replace('标清高清/MP3_128_16_Stero', '歌曲下载/flac_24bit')
          .replace('.mp3', '.flac')
      case 1:
      default:
        return url
    }
  },
  // 高音质资源可能缺失（404），按降级链逐级回退：ZQ24 → SQ → HQ → PQ
  fallbackChain: { 4: [4, 3, 2, 1], 3: [3, 2, 1], 2: [2, 1], 1: [1] } as Record<number, number[]>,
  /**
   * 按降级链逐级升级并探测，返回第一个可用的链接
   */
  async resolveAvailableUrl(rawUrl: string, flag: number): Promise<string> {
    const base = decodeURIComponent(rawUrl)
    const chain = this.fallbackChain[flag] || [1]
    for (const level of chain) {
      const candidate = this.upgradeUrl(rawUrl, level)
      // PQ 为接口直出链接，无需探测
      if (level === 1 || (await isMiguUrlAvailable(candidate))) {
        if (level !== flag) {
          console.warn(`[musicUrl] 咪咕 ${flag} 音质链接不可用，已降级为 ${level}`)
        }
        return candidate
      }
    }
    return base
  }
}

/**
 * HEAD 探测链接可用性；跨域受限或网络异常时保守视为可用，避免误降级
 */
async function isMiguUrlAvailable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return true
  }
}

const fetchXinghaiMiguUrl = async (
  contentId: string,
  meta?: MusicTrackMeta,
  miguFlag?: number
): Promise<string | null> => {
  // 缓存需区分音质，避免不同音质请求互相命中返回错误音质的链接
  const cacheKey = `migu:${contentId}:${miguFlag || 1}`
  const cached = xinghaiUrlCache.get(cacheKey)
  if (cached && cached.expireAt > Date.now()) {
    return cached.url
  }

  // 清理过期缓存条目，避免无界增长
  const now = Date.now()
  for (const [key, entry] of xinghaiUrlCache) {
    if (entry.expireAt <= now) {
      xinghaiUrlCache.delete(key)
    }
  }

  // 并发合并：同一歌曲的并发请求只发一次
  const inflight = xinghaiInflight.get(cacheKey)
  if (inflight) {
    return inflight
  }

  // 滑动窗口限流：超限时直接失败，避免触发星海 429
  const windowStart = now - XINGHAI_RATE_LIMIT_WINDOW
  while (xinghaiRequestTimes.length > 0 && xinghaiRequestTimes[0] < windowStart) {
    xinghaiRequestTimes.shift()
  }
  if (xinghaiRequestTimes.length >= XINGHAI_RATE_LIMIT_MAX) {
    console.warn('[musicUrl] 星海音源请求过于频繁，跳过本次请求')
    return null
  }

  const promise = (async (): Promise<string | null> => {
    try {
      xinghaiRequestTimes.push(Date.now())
      const params: Record<string, string> = {
        source: 'migu',
        songmid: contentId,
        quality: '128k'
      }
      if (meta?.name) params.name = meta.name
      if (meta?.artist) params.singer = meta.artist
      if (meta?.album) params.albumName = meta.album

      const query = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      const response: any = await $fetch(`${XINGHAI_BASE_URL}?${query}`, {
        timeout: 8000
      })

      if (response?.code === 200 && response?.url) {
        let url = await miguQuality.resolveAvailableUrl(response.url.split('?')[0], miguFlag || 1)
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://')
        }
        xinghaiUrlCache.set(cacheKey, { url, expireAt: Date.now() + XINGHAI_CACHE_TTL })
        return url
      }
    } catch (error) {
      console.warn('[musicUrl] 星海音源获取咪咕播放链接失败:', error)
    }
    return null
  })()

  xinghaiInflight.set(cacheKey, promise)
  promise.finally(() => {
    xinghaiInflight.delete(cacheKey)
  })
  return promise
}

const musicUrlSourceCache = new Map<string, string>()

const normalizeCacheUrl = (url: string) => {
  return url.trim().replace(/^http:\/\//, 'https://')
}

export const isKnownInvalidQqAudioUrl = (url: string | null | undefined) => {
  if (!url) return false
  const normalizedUrl = normalizeCacheUrl(url)
  const urlWithoutParams = normalizedUrl.split('?')[0].split('#')[0]
  return urlWithoutParams.endsWith(INVALID_QQ_AUDIO_URL_SUFFIX)
}

const rememberMusicUrlSource = (url: string | null | undefined, source?: string) => {
  if (!url || !source) return
  musicUrlSourceCache.set(normalizeCacheUrl(url), source)
}

export const getCachedMusicUrlSource = (url: string | null | undefined) => {
  if (!url) return null
  return musicUrlSourceCache.get(normalizeCacheUrl(url)) || null
}

export async function getMusicUrlResult(
  platform: string,
  musicId: string | number,
  playUrl?: string,
  options?: MusicUrlResolveOptions
): Promise<MusicUrlResolveResult> {
  // 如果用户提供了播放链接，优先使用
  if (!options?.ignoreProvidedUrl && playUrl && playUrl.trim()) {
    return {
      url: playUrl.trim(),
      source: 'play-url'
    }
  }

  // 如果没有playUrl，但platform或musicId为空或无效，则无法获取播放链接
  if (
    !platform ||
    !musicId ||
    platform === 'unknown' ||
    platform === '' ||
    musicId === null ||
    musicId === ''
  ) {
    throw new Error('缺少音乐平台或音乐ID信息')
  }

  const { getQuality } = useAudioQuality()

  // 优先使用 options 中的 quality，否则使用全局设置
  const quality = options?.quality !== undefined ? options.quality : getQuality(platform)

  if (platform === 'tencent') {
    const normalizedQuality = Number(quality)
    const qualityCandidates = [Number.isNaN(normalizedQuality) ? 8 : normalizedQuality]
    const excludedSources = new Set(options?.excludeSources || [])
    const qqMusicCookie =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('qq_music_cookie') || undefined
        : undefined
    // VIP 状态由登录校验接口写入（qq_music_vip），仅 VIP 才值得优先走官方链路
    const isQqVip =
      typeof window !== 'undefined' && window.localStorage.getItem('qq_music_vip') === '1'
    const requestBackendResolve = async (
      strategy: 'official-first' | 'fallback' = 'fallback'
    ) => {
      const response: any = await $fetch('/api/music/resolve-url', {
        method: 'POST',
        body: {
          platform,
          musicId: String(musicId),
          quality,
          mediaId: options?.mediaId,
          playUrl: options?.ignoreProvidedUrl ? undefined : playUrl,
          cookie: qqMusicCookie,
          excludeSources: [...excludedSources],
          strategy
        }
      })

      if (response?.success && response?.url) {
        if (platform === 'tencent' && qqMusicCookie && response.authUsed === false) {
          console.warn('[musicUrl] 已检测到 QQ 音乐本地登录态，但后端解析未使用登录 Cookie')
        }
        rememberMusicUrlSource(response.url, response.source)
        return {
          url: response.url,
          source: response.source,
          normalizedMusicId: response.normalizedMusicId,
          idType: response.idType
        }
      }

      throw new Error(response?.message || 'QQ音乐播放链接解析失败')
    }

    // VIP 登录态：优先后端用用户 Cookie 走官方链路换取直链，失败再降级第三方音源
    if (qqMusicCookie && isQqVip && !excludedSources.has('qq-official')) {
      try {
        return await requestBackendResolve('official-first')
      } catch (error: any) {
        console.warn('[musicUrl] QQ 官方登录态解析失败，降级第三方音源:', error?.message || error)
      }
    }

    // K×H 音源提取的 QQ 直连接口支持浏览器跨域，优先于 vkeys 使用。
    if (!excludedSources.has('ygking-qq')) {
      const ygkingQuality: Record<number, string> = {
        4: '128',
        8: '320',
        10: 'flac',
        11: 'master',
        14: 'master'
      }
      const qualityKey = ygkingQuality[qualityCandidates[0]] || '320'
      try {
        const data: any = await fetch(
          `https://api.ygking.top/api/song/url?mid=${encodeURIComponent(String(musicId))}&quality=${encodeURIComponent(qualityKey)}`,
          { signal: AbortSignal.timeout(5000) }
        ).then((result) => (result.ok ? result.json() : null))
        const url =
          data?.data?.[String(musicId)] || (data?.data && data.data[Object.keys(data.data)[0]])
        if (data?.code === 0 && url && !isKnownInvalidQqAudioUrl(String(url))) {
          rememberMusicUrlSource(String(url), 'ygking-qq')
          return { url: String(url), source: 'ygking-qq' }
        }
      } catch {
        // 继续尝试后端 HYW 与 vkeys。
      }
    }

    if (!excludedSources.has('hyw-tx')) {
      try {
        return await requestBackendResolve()
      } catch (error: any) {
        console.warn('[musicUrl] HYW 后端解析失败，继续尝试 vkeys 音源:', error?.message || error)
      }
    }

    // v3 负责探测歌曲支持的音质，播放链接仍由 v2 获取。
    if (!excludedSources.has('vkeys-v3') && !excludedSources.has('vkeys')) {
      try {
        const idParam = getVkeysIdParam('tencent', musicId)
        const infoResponse: any = await fetch(
          `https://api.vkeys.cn/music/tencent/song/info?${idParam.key}=${encodeURIComponent(idParam.value)}`,
          { signal: AbortSignal.timeout(5000) }
        ).then((response) => (response.ok ? response.json() : null))
        const qualityInfo = Array.isArray(infoResponse?.data?.qualityInfo)
          ? infoResponse.data.qualityInfo
          : []
        const selectedQuality = [...new Set([qualityCandidates[0], 8, 4, 10, 11, 14])].find(
          (candidate) =>
            qualityInfo.some(
              (item: any) => Number(item.type) === candidate && Number(item.size) > 0
            )
        )
        if (infoResponse?.code === 0 && selectedQuality !== undefined) {
          const v2Response: any = await fetch(
            `https://api.vkeys.cn/v2/music/tencent?${idParam.key}=${encodeURIComponent(idParam.value)}&quality=${selectedQuality}`,
            { signal: AbortSignal.timeout(5000) }
          ).then((response) => (response.ok ? response.json() : null))
          const url = v2Response?.data?.url
          if (v2Response?.code === 200 && url && !isKnownInvalidQqAudioUrl(String(url))) {
            rememberMusicUrlSource(String(url), 'vkeys-v3')
            return { url: String(url), source: 'vkeys-v3' }
          }
        }
      } catch {
        // v3 失败后继续尝试 v2。
      }
    }

    if (!excludedSources.has('vkeys')) {
      for (const candidateQuality of qualityCandidates) {
        const idParam = getVkeysIdParam('tencent', musicId)
        const vkeysUrl = `https://api.vkeys.cn/v2/music/tencent?${idParam.key}=${encodeURIComponent(idParam.value)}&quality=${candidateQuality}`

        try {
          const vkeysResp = await fetch(vkeysUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(5000)
          })

          if (vkeysResp.ok) {
            const data = await vkeysResp.json()
            if (data.code === 200 && data.data && data.data.url) {
              let url = data.data.url
              if (url.startsWith('http://')) {
                url = url.replace('http://', 'https://')
              }
              if (isKnownInvalidQqAudioUrl(url)) {
                continue
              }
              rememberMusicUrlSource(url, 'vkeys')
              return {
                url,
                source: 'vkeys'
              }
            }
          }
        } catch {
          // 该音质请求失败，继续尝试下一个音质候选
        }
      }
    }

    // 非 VIP 登录态：官方链路作为最后兜底
    if (qqMusicCookie && !isQqVip && !excludedSources.has('qq-official')) {
      try {
        return await requestBackendResolve('official-first')
      } catch (error: any) {
        console.warn('[musicUrl] QQ 官方链路兜底失败:', error?.message || error)
      }
    }

    throw new Error('QQ音乐播放链接解析失败')
  }

  const { getSongUrl } = useMusicSources()
  const isNeteasePlatform = platform === 'netease' || platform === 'netease-podcast'
  const hasNeteaseLogin =
    isNeteasePlatform &&
    typeof window !== 'undefined' &&
    !!window.localStorage.getItem('netease_cookie')

  let finalMusicId = musicId
  let bilibiliCid: string | undefined

  if (platform === 'bilibili') {
    const parsed = parseBilibiliId(musicId)
    finalMusicId = parsed.bvid
    bilibiliCid = parsed.cid
  }

  const extendedOptions = {
    ...options,
    bilibiliCid,
    excludeSources: options?.excludeSources
  }

  // 先使用统一组件的音源选择逻辑
  const backupResult = await getSongUrl(finalMusicId, quality, platform, undefined, extendedOptions)
  if (backupResult.success && backupResult.url) {
    rememberMusicUrlSource(backupResult.url, backupResult.source || 'music-source')
    return {
      url: backupResult.url,
      source: backupResult.source || 'music-source'
    }
  }

  // 如果是 Bilibili 平台，且 getSongUrl 失败，则直接抛出错误
  if (platform === 'bilibili') {
    throw new Error(backupResult.error || '获取哔哩哔哩播放链接失败')
  }

  // 回退到 vkeys
  const normalizedQuality = Number(quality)
  const qualityCandidates = isNeteasePlatform
    ? !hasNeteaseLogin && normalizedQuality > 4
      ? [...new Set([normalizedQuality, 4])]
      : [Number.isNaN(normalizedQuality) ? 0 : normalizedQuality]
    : [Number.isNaN(normalizedQuality) ? 8 : normalizedQuality]

  const endpoint =
    platform === 'netease' || platform === 'netease-podcast'
      ? 'netease'
      : platform === 'tencent'
        ? 'tencent'
        : platform === 'migu'
          ? 'migu'
          : null

  if (!endpoint) {
    throw new Error('不支持的音乐平台')
  }

  // 咪咕音乐特殊处理
  if (platform === 'migu') {
    // 服务器位于海外时直接使用星海音源（咪咕官方接口屏蔽海外 IP）
    const { isServerInChina, checkServerLocation } = useMusicSources()
    if (isServerInChina.value === null) {
      await checkServerLocation()
    }
    if (isServerInChina.value === false) {
      const xinghaiUrl = await fetchXinghaiMiguUrl(String(musicId), options?.musicInfo, quality)
      if (xinghaiUrl) {
        rememberMusicUrlSource(xinghaiUrl, 'xinghai')
        return {
          url: xinghaiUrl,
          source: 'xinghai'
        }
      }
      throw new Error('咪咕音乐播放链接获取失败（星海音源不可用）')
    }

    try {
      // 服务端以 PQ 取链后按 toneFlag 升级音质路径，客户端不再二次处理
      const miguResponse: any = await $fetch('/api/native-api/migu/playurl', {
        params: {
          contentId: String(musicId),
          toneFlag: miguQuality.flagMap[quality as number] || 'PQ'
        },
        timeout: 10000
      })

      if (miguResponse?.success && miguResponse?.url) {
        let miguUrl = miguResponse.url
        // 与星海分支保持一致，避免 http 链接在 https 部署下被混合内容策略拦截
        if (miguUrl.startsWith('http://')) {
          miguUrl = miguUrl.replace('http://', 'https://')
        }
        rememberMusicUrlSource(miguUrl, 'migu')
        return {
          url: miguUrl,
          source: 'migu'
        }
      }
    } catch (error) {
      console.error('[musicUrl] 咪咕播放链接获取失败:', error)
    }

    // 官方接口失败时回退星海音源
    const xinghaiUrl = await fetchXinghaiMiguUrl(String(musicId), options?.musicInfo, quality)
    if (xinghaiUrl) {
      rememberMusicUrlSource(xinghaiUrl, 'xinghai')
      return {
        url: xinghaiUrl,
        source: 'xinghai'
      }
    }
    throw new Error('咪咕音乐播放链接获取失败')
  }

  for (const candidateQuality of qualityCandidates) {
    const idParam = getVkeysIdParam(endpoint as 'netease' | 'tencent', musicId)
    const apiUrl = `https://api.vkeys.cn/v2/music/${endpoint}?${idParam.key}=${encodeURIComponent(idParam.value)}&quality=${candidateQuality}`
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      continue
    }

    const data = await response.json()
    if (data.code === 200 && data.data && data.data.url) {
      // 将HTTP URL改为HTTPS
      let url = data.data.url
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      if (endpoint === 'tencent' && isKnownInvalidQqAudioUrl(url)) {
        continue
      }
      rememberMusicUrlSource(url, 'vkeys')
      return {
        url,
        source: 'vkeys'
      }
    }
  }

  // vkeys API返回了响应但没有有效的播放链接
  throw new Error('vkeys API返回的播放链接无效')
}

export async function getMusicUrl(
  platform: string,
  musicId: string | number,
  playUrl?: string,
  options?: MusicUrlResolveOptions
): Promise<string | null> {
  const result = await getMusicUrlResult(platform, musicId, playUrl, options)
  return result.url
}
