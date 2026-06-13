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
}

export type MusicUrlResolveResult = {
  url: string | null
  source?: string
  normalizedMusicId?: string
  idType?: string
}

export const INVALID_QQ_AUDIO_URL_SUFFIX = '/2149972737147268278.mp3'

const musicUrlSourceCache = new Map<string, string>()

const normalizeCacheUrl = (url: string) => {
  return url.trim().replace(/^http:\/\//, 'https://')
}

export const isKnownInvalidQqAudioUrl = (url: string | null | undefined) => {
  if (!url) return false
  const normalizedUrl = normalizeCacheUrl(url)
  const urlWithoutParams = normalizedUrl.split('?')[0].split('#')[0];
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
  const quality =
    options?.quality !== undefined ? options.quality : getQuality(platform)

  if (platform === 'tencent') {
    const normalizedQuality = Number(quality)
    const qualityCandidates = [Number.isNaN(normalizedQuality) ? 8 : normalizedQuality]
    const excludedSources = new Set(options?.excludeSources || [])
    const qqMusicCookie =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('qq_music_cookie') || undefined
        : undefined
    const requestBackendResolve = async () => {
      const response: any = await $fetch('/api/music/resolve-url', {
        method: 'POST',
        body: {
          platform,
          musicId: String(musicId),
          quality,
          mediaId: options?.mediaId,
          playUrl: options?.ignoreProvidedUrl ? undefined : playUrl,
          cookie: qqMusicCookie,
          excludeSources: [...excludedSources]
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

    if (qqMusicCookie) {
      try {
        return await requestBackendResolve()
      } catch {
        // 登录态官方包失败后继续回退内置前端音源
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
          // vkeys 前端请求失败，继续走后端代理
        }
      }
    }

    // vkeys 前端失败，回退到后端 resolve-url
    if (!qqMusicCookie) {
      return await requestBackendResolve()
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
  const backupResult = await getSongUrl(
    finalMusicId,
    quality,
    platform,
    undefined,
    extendedOptions
  )
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
  const qualityCandidates =
    isNeteasePlatform
      ? !hasNeteaseLogin && normalizedQuality > 4
        ? [...new Set([normalizedQuality, 4])]
        : [Number.isNaN(normalizedQuality) ? 0 : normalizedQuality]
      : [Number.isNaN(normalizedQuality) ? 8 : normalizedQuality]

  const endpoint =
    platform === 'netease' || platform === 'netease-podcast'
      ? 'netease'
      : platform === 'tencent'
        ? 'tencent'
        : null

  if (!endpoint) {
    throw new Error('不支持的音乐平台')
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
