/**
 * 音源管理器 Composable
 * 提供多音源搜索、故障转移和状态监控功能
 */

import {
  getEnabledSources,
  getSourceById,
  getVkeysIdParam,
  MUSIC_SOURCE_CONFIG,
  type MusicSearchParams,
  type MusicSearchResult,
  type MusicSource,
  type MusicSourceConfig,
  type SongDetailParams,
  type SongDetailResult,
  type SourceStatus
} from '~/utils/musicSources'
import { getBilibiliTrackUrl, searchBilibili, parseBilibiliId } from '~/utils/bilibiliSource'
import { useLyricSettings } from './useLyricSettings'

// 歌词请求缓存，避免同一首歌重复请求
const lyricCache = new Map<string, Promise<any>>()
const lyricProgressSubscribers = new Map<string, Set<LyricProgressCallback>>()
const LYRIC_CACHE_TTL = 60 * 1000

type LyricProgressStage = 'official' | 'qm' | 'amll' | 'upgrade' | 'meting'

type LyricProgressPayload = {
  stage: LyricProgressStage
  data: LyricResultData
}

type LyricProgressCallback = (payload: LyricProgressPayload) => void

type LyricUpgradeMeta = {
  title?: string
  artist?: string
  album?: string
  /** 毫秒，用于跨平台匹配时过滤时长差异过大的候选 */
  duration?: number
  /** false = 明确禁止跨平台升级（防止递归），undefined/true = 允许 */
  allowCrossPlatformUpgrade?: boolean
  /** 用于歌词页先显示基础歌词，再切换到更高阶歌词 */
  onProgress?: LyricProgressCallback
}

type LyricResultData = { lrc: string; trans?: string; yrc?: string; ttml?: string }

/**
 * 格式优先级：数字越小越高阶。
 * 用于判断对侧平台的歌词是否值得覆盖当前结果。
 */
const LYRIC_FORMAT_RANK: Record<string, number> = {
  ttml: 0,
  qrc: 1,
  yrc: 1,  // yrc 与 qrc 同阶，都是逐字
  lrc: 2,
  none: 3,
}

/** 当前 LyricResultData 的最高阶格式 rank（数字越小越高阶） */
const getCurrentRank = (data: LyricResultData): number => {
  if (data.ttml) return LYRIC_FORMAT_RANK.ttml
  if (data.yrc) return LYRIC_FORMAT_RANK.yrc
  if (data.lrc) return LYRIC_FORMAT_RANK.lrc
  return LYRIC_FORMAT_RANK.none
}

/** 候选数据的最高阶格式 rank */
const getCandidateRank = (data: LyricResultData): number => {
  if (data.ttml) return LYRIC_FORMAT_RANK.ttml
  if (data.yrc) return LYRIC_FORMAT_RANK.yrc
  if (data.lrc) return LYRIC_FORMAT_RANK.lrc
  return LYRIC_FORMAT_RANK.none
}

/** 歌词候选匹配文本归一化：小写，去标点/空白/常见联唱标记 */
const normalizeLyricMatchText = (value: string): string => {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(?:feat|ft)\.?\s*/gi, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[、;，,/|()（）·・\s\-_'"`~!?？！.。《》【】\[\]{}^*@#$%+=\\]+/g, '')
}

/** 双向 includes */
const bothContains = (a: string, b: string): boolean =>
  a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a))

/** 拆分多歌手文本，避免同名歌曲只比较整串导致误判 */
const splitLyricMatchArtists = (value?: string): string[] =>
  String(value || '')
    .split(/[、&＆;，,/|·・]+/g)
    .map((artist) => normalizeLyricMatchText(artist))
    .filter(Boolean)

const matchLyricArtists = (
  candidateArtist: string | undefined,
  trackArtists: readonly string[]
): { exact: boolean; contains: boolean } => {
  if (!trackArtists.length) return { exact: false, contains: false }

  const candFull = normalizeLyricMatchText(candidateArtist || '')
  const candParts = splitLyricMatchArtists(candidateArtist)
  if (!candFull) return { exact: false, contains: false }

  const exact = trackArtists.some(
    (artist) => candFull === artist || candParts.some((part) => part === artist)
  )
  if (exact) return { exact: true, contains: false }

  const contains = trackArtists.some(
    (artist) =>
      artist.length >= 2 &&
      (bothContains(candFull, artist) || candParts.some((part) => bothContains(part, artist)))
  )

  return { exact: false, contains }
}

const isDurationClose = (left?: number, right?: number, tolerance = 5000): boolean =>
  typeof left === 'number' && typeof right === 'number' && Math.abs(left - right) <= tolerance

/** 子串占长串的最低比例，过低视为巧合 */
const NAME_CONTAIN_MIN_RATIO = 0.34

/**
 * 从候选列表中挑出最匹配的结果，返回候选对象或 null。
 *
 * 硬性条件（不满足直接跳过）：
 *  - title 全等，或双向 includes 且短串占长串比例 ≥ NAME_CONTAIN_MIN_RATIO
 *  - 原歌曲有 artist 时，候选必须命中至少一个 artist（防止同名异歌手误匹配）
 *  - title 仅子串命中时，必须有 artist 或接近时长佐证（防止巧合子串误匹配）
 *  - 双方都有 duration 时，差距不能超过 20s
 *
 * 打分规则（分越高越优先，须 ≥ MIN_SCORE）：
 *  - title 全等 +10，子串命中 +4
 *  - artist 全等 +5，双向 includes +2
 *  - album 全等 +2
 *  - duration 接近（±5s）+3
 */
const MIN_SCORE = 4

const pickBestLyricCandidate = <
  T extends { title?: string; artist?: string; album?: string; duration?: number }
>(
  candidates: T[],
  track: { title?: string; artist?: string; album?: string; duration?: number }
): T | null => {
  const trackTitle = normalizeLyricMatchText(track.title || '')
  const trackArtists = splitLyricMatchArtists(track.artist)
  const trackAlbum = normalizeLyricMatchText(track.album || '')
  const trackDuration = track.duration

  let best: T | null = null
  let bestScore = MIN_SCORE - 1

  for (const candidate of candidates) {
    const candTitle = normalizeLyricMatchText(candidate.title || '')
    const candAlbum = normalizeLyricMatchText(candidate.album || '')

    // 硬性：title 必须匹配
    const titleExact = candTitle.length > 0 && candTitle === trackTitle
    if (!titleExact) {
      if (!bothContains(candTitle, trackTitle)) continue
      const longer = Math.max(candTitle.length, trackTitle.length)
      const shorter = Math.min(candTitle.length, trackTitle.length)
      if (shorter / longer < NAME_CONTAIN_MIN_RATIO) continue
    }

    // 硬性：时长差距超过 20s 直接跳过
    if (
      typeof trackDuration === 'number' &&
      typeof candidate.duration === 'number' &&
      Math.abs(trackDuration - candidate.duration) > 20000
    ) continue

    const artist = matchLyricArtists(candidate.artist, trackArtists)

    // 硬性：原歌曲有歌手时，候选也必须命中歌手，避免同名异歌手歌词串台
    if (trackArtists.length > 0 && !artist.exact && !artist.contains) continue

    // 硬性：title 仅子串命中时，必须有歌手或时长佐证
    if (
      !titleExact &&
      !artist.exact &&
      !artist.contains &&
      !isDurationClose(candidate.duration, trackDuration)
    ) {
      continue
    }

    let score = titleExact ? 10 : 4
    if (artist.exact) score += 5
    else if (artist.contains) score += 2
    if (trackAlbum && candAlbum === trackAlbum) score += 2
    if (isDurationClose(candidate.duration, trackDuration)) score += 3

    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

const buildLyricUpgradeQueries = (meta: LyricUpgradeMeta) => {
  const title = meta.title?.trim() || ''
  const artist = meta.artist?.trim() || ''
  const album = meta.album?.trim() || ''

  const queries = new Set<string>()
  if (title && artist) {
    queries.add(`${title} ${artist}`)
    queries.add(`${artist} ${title}`)
  }
  if (title) queries.add(title)
  if (title && album) queries.add(`${title} ${album}`)
  return [...queries].filter(Boolean)
}

const getLyricCacheKey = (platform: string, id: number | string, meta?: LyricUpgradeMeta) => {
  const title = normalizeLyricMatchText(meta?.title || '')
  const artist = normalizeLyricMatchText(meta?.artist || '')
  const album = normalizeLyricMatchText(meta?.album || '')
  // allowCrossPlatformUpgrade=false 与 undefined/true 的结果不同，需区分
  const upgradeFlag = meta?.allowCrossPlatformUpgrade === false ? '0' : '1'
  return `${platform}:${id}:${title}:${artist}:${album}:${upgradeFlag}`
}

const cloneLyricData = (data: LyricResultData): LyricResultData => ({
  lrc: data.lrc || '',
  trans: data.trans || '',
  yrc: data.yrc || '',
  ttml: data.ttml || ''
})

const subscribeLyricProgress = (
  cacheKey: string,
  callback?: LyricProgressCallback
): (() => void) => {
  if (!callback) return () => {}

  let subscribers = lyricProgressSubscribers.get(cacheKey)
  if (!subscribers) {
    subscribers = new Set()
    lyricProgressSubscribers.set(cacheKey, subscribers)
  }
  subscribers.add(callback)

  return () => {
    const currentSubscribers = lyricProgressSubscribers.get(cacheKey)
    if (!currentSubscribers) return
    currentSubscribers.delete(callback)
    if (currentSubscribers.size === 0) {
      lyricProgressSubscribers.delete(cacheKey)
    }
  }
}

const emitLyricProgress = (cacheKey: string, stage: LyricProgressStage, data: LyricResultData) => {
  const subscribers = lyricProgressSubscribers.get(cacheKey)
  if (!subscribers?.size) return

  const payload = { stage, data: cloneLyricData(data) }
  for (const callback of subscribers) {
    try {
      callback(payload)
    } catch (error) {
      console.warn('[getLyrics] 歌词进度回调失败:', error)
    }
  }
}

/**
 * 音源管理器 Composable
 */
export const useMusicSources = () => {
  // 配置
  const config = ref<MusicSourceConfig>(MUSIC_SOURCE_CONFIG)

  // 当前使用的音源
  const currentSource = ref<string>(config.value.primarySource)

  // 音源状态
  const sourceStatus = ref<Record<string, SourceStatus>>({})

  /**
   * 使用 Meting API 获取歌曲信息
   * @param id 歌曲ID
   * @param source Meting API 音源
   * @returns Promise<{success: boolean, data?: any, error?: string}>
   */
  const getMetingSongInfo = async (
    id: string | number,
    source: MusicSource
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> => {
    try {
      const metingUrl = `${source.baseUrl}/?server=netease&type=song&id=${id}`

      const response = await $fetch(metingUrl, {
        timeout: source.timeout || 8000,
        headers: source.headers
      })

      // Meting API 返回歌曲信息数组
      if (Array.isArray(response) && response.length > 0) {
        const songInfo = response[0]
        return {
          success: true,
          data: {
            name: songInfo.name,
            artist: songInfo.artist,
            url: songInfo.url,
            pic: songInfo.pic,
            lrc: songInfo.lrc
          }
        }
      }

      return { success: false, error: 'Meting API 未返回有效数据' }
    } catch (error: any) {
      return { success: false, error: error?.message || '未知错误' }
    }
  }

  /**
   * 尝试从对侧平台获取更高阶格式的歌词（TTML > QRC/YRC > LRC）。
   *
   * 触发条件（全部满足）：
   *  1. 调用方未显式禁止跨平台升级（allowCrossPlatformUpgrade !== false）
   *  2. 当前数据不是最高阶（即无 TTML）
   *  3. meta 提供了 title + artist 以便搜索
   *
   * 升级策略：
   *  - 目标平台为对侧（netease ↔ tencent）
   *  - 对侧结果必须比当前格式更高阶才接受
   *  - TTML 需要 enableOnlineTTMLLyric 开启才接受
   */
  const tryUpgradeLyric = async (
    platform: 'netease' | 'tencent',
    currentData: LyricResultData,
    meta?: LyricUpgradeMeta
  ): Promise<boolean> => {
    if (meta?.allowCrossPlatformUpgrade === false) return false
    if (!meta?.title || !meta?.artist) return false
    if (currentData.ttml) return false

    const currentRank = getCurrentRank(currentData)
    const targetPlatform = platform === 'netease' ? 'tencent' : 'netease'
    const queries = buildLyricUpgradeQueries(meta)
    if (queries.length === 0) return false

    let matchedTrack: any = null

    for (const keywords of queries) {
      try {
        const searchResult = await searchSongs({
          keywords,
          platform: targetPlatform,
          type: 1,
          limit: 10
        })

        if (!searchResult.success || !Array.isArray(searchResult.data) || !searchResult.data.length) {
          continue
        }

        const candidates = searchResult.data.map((song: any) => ({
          title: song.title || song.name || '',
          artist: song.artist || song.singer || '',
          album: song.album || song.albumName || '',
          duration: song.duration,
          _song: song
        }))

        const best = pickBestLyricCandidate(candidates, meta)
        if (best) {
          matchedTrack = (best as any)._song
          break
        }
      } catch (error: any) {
        console.warn('[getLyrics] 跨平台升级搜索失败:', error?.message || error)
      }
    }

    if (!matchedTrack?.musicId) return false

    try {
      const upgraded = await fetchLyricsWithoutUpgrade(
        matchedTrack.musicPlatform || targetPlatform,
        matchedTrack.musicId,
        {
          title: matchedTrack.title,
          artist: matchedTrack.artist,
          album: matchedTrack.album,
          allowCrossPlatformUpgrade: false  // 防止无限递归
        }
      )

      if (!upgraded.success || !upgraded.data) return false

      const upgradedRank = getCandidateRank(upgraded.data)

      // TTML 需要开关许可
      if (upgradedRank === LYRIC_FORMAT_RANK.ttml && !useLyricSettings().enableOnlineTTMLLyric.value) {
        // TTML 被禁用，但如果有 yrc/qrc 也可以升级
        if (upgraded.data.yrc && LYRIC_FORMAT_RANK.yrc < currentRank) {
          currentData.yrc = upgraded.data.yrc
          if (upgraded.data.trans && !currentData.trans) currentData.trans = upgraded.data.trans
          return true
        }
        return false
      }

      // 对侧格式必须比当前更高阶
      if (upgradedRank >= currentRank) return false

      if (upgraded.data.ttml) {
        currentData.ttml = upgraded.data.ttml
      } else if (upgraded.data.yrc) {
        currentData.yrc = upgraded.data.yrc
      }
      // 补充翻译（如果当前没有）
      if (upgraded.data.trans && !currentData.trans) {
        currentData.trans = upgraded.data.trans
      }
      return true
    } catch (error: any) {
      console.warn('[getLyrics] 跨平台升级获取失败:', error?.message || error)
    }

    return false
  }

  const fetchLyricsWithoutUpgrade = async (
    platform: 'netease' | 'tencent',
    id: number | string,
    meta?: LyricUpgradeMeta
  ): Promise<{
    success: boolean
    data?: LyricResultData
    error?: string
  }> => {
    const cacheKey = getLyricCacheKey(platform, id, meta)
    const unsubscribeProgress = subscribeLyricProgress(cacheKey, meta?.onProgress)
    const progressive = typeof meta?.onProgress === 'function'

    const cached = lyricCache.get(cacheKey)
    if (cached) {
      return cached.finally(unsubscribeProgress)
    }

    const promise = (async () => {
      try {
        const settings = useLyricSettings()
        const enabledSources = getEnabledSources()
        const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))
        const vkeysSource = enabledSources.find((source) => source.id === 'vkeys')

        const resultData: LyricResultData = { lrc: '', trans: '', yrc: '', ttml: '' }
        let hasResult = false
        let lastProgressSignature = ''

        const emitProgress = (stage: LyricProgressStage) => {
          const signature = [
            stage,
            resultData.lrc?.length || 0,
            resultData.trans?.length || 0,
            resultData.yrc?.length || 0,
            resultData.ttml?.length || 0
          ].join(':')
          if (signature === lastProgressSignature) return
          lastProgressSignature = signature
          emitLyricProgress(cacheKey, stage, resultData)
        }

        const fetchOfficial = async () => {
          if (platform !== 'netease' || !neteaseSource) return
          try {
            const [lrcResp, yrcResp] = await Promise.allSettled([
              $fetch(`${neteaseSource.baseUrl}/lyric`, {
                params: { id: id.toString() },
                timeout: neteaseSource.timeout || 8000
              }),
              $fetch(`${neteaseSource.baseUrl}/lyric/new`, {
                params: { id: id.toString() },
                timeout: neteaseSource.timeout || 8000
              })
            ])

            if (lrcResp.status === 'fulfilled' && lrcResp.value?.code === 200) {
              const lr = lrcResp.value
              if (lr?.lrc?.lyric) resultData.lrc = lr.lrc.lyric
              if (lr?.tlyric?.lyric) resultData.trans = lr.tlyric.lyric
            }
            if (yrcResp.status === 'fulfilled' && yrcResp.value?.code === 200) {
              const yr = yrcResp.value
              if (yr?.yrc?.lyric) resultData.yrc = yr.yrc.lyric
            }

            if (resultData.lrc || resultData.yrc) {
              hasResult = true
              emitProgress('official')
            }
          } catch (e: any) {
            console.warn('[getLyrics] NeteaseCloudMusicApi 获取失败:', e?.message || e)
          }
        }

        const fetchAMLL = async () => {
          if (!settings.enableOnlineTTMLLyric.value) return

          try {
            let url: string
            if (platform === 'tencent') {
              url = `https://amlldb.bikonoo.com/lyrics/qq-lyrics/${id}`
            } else if (platform === 'netease') {
              const serverUrl = settings.amllDbServer.value
              if (!serverUrl) return
              url = serverUrl.replace('%s', id.toString())
            } else {
              return
            }

            const ttml = await $fetch(url, { responseType: 'text' })
            if (ttml && typeof ttml === 'string' && ttml.includes('<tt')) {
              resultData.ttml = ttml
              hasResult = true
              emitProgress('amll')
            }
          } catch {
          }
        }

        const fetchQM = async () => {
          if (!settings.enableQQMusicLyric.value && settings.lyricPriority.value !== 'qm') return

          if (platform === 'tencent') {
            try {
              let qqMusicCookie = ''
              if (import.meta.client) {
                qqMusicCookie = localStorage.getItem('qq_music_cookie') || ''
              }

              // 传入元信息以提高原生 QRC 接口匹配精度
              const nativeResp = await $fetch('/api/native-api/lyric/tx', {
                params: {
                  songmid: String(id),
                  ...(meta?.title ? { name: meta.title } : {}),
                  ...(meta?.artist ? { artist: meta.artist } : {}),
                  ...(meta?.album ? { album: meta.album } : {}),
                  ...(qqMusicCookie ? { cookie: qqMusicCookie } : {})
                },
                timeout: 8000
              })
              if (nativeResp?.success && nativeResp?.data) {
                const d = nativeResp.data
                // qrc 优先于 lrc，两者都写入，解析层按优先级选择
                if (d.qrc) resultData.yrc = d.qrc   // 用 yrc 字段承载 QRC，解析器会识别 XML 格式
                if (d.lrc) resultData.lrc = d.lrc
                if (d.trans) resultData.trans = d.trans
                if (d.qrc || d.lrc) {
                  hasResult = true
                  emitProgress('qm')
                  return
                }
              }
            } catch (e) {
              console.warn('[getLyrics] 原生歌词接口失败:', e)
            }
          }

          if (!vkeysSource) return

          try {
            let url: string
            const lyricIdParam = getVkeysIdParam(platform as 'netease' | 'tencent', id)
            if (platform === 'netease') {
              url = `${vkeysSource.baseUrl}/netease/lyric?${lyricIdParam.key}=${encodeURIComponent(lyricIdParam.value)}`
            } else if (platform === 'tencent') {
              url = `${vkeysSource.baseUrl}/tencent/lyric?${lyricIdParam.key}=${encodeURIComponent(lyricIdParam.value)}`
            } else {
              return
            }

            const resp = await $fetch(url, {
              timeout: vkeysSource.timeout || 8000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            if (resp?.code === 200 && resp?.data) {
              const d = resp.data
              if (d.lrc) resultData.lrc = d.lrc
              if (d.trans) resultData.trans = d.trans
              if (d.yrc) resultData.yrc = d.yrc
              if (d.lrc || d.yrc) {
                hasResult = true
                emitProgress('qm')
              }
            }
          } catch (e) {
            console.warn('[getLyrics] vkeys 获取失败:', e)
          }
        }

        const priority = settings.lyricPriority.value
        if (progressive) {
          if (platform === 'netease') {
            let triedQM = false
            const fetchQMOnce = async () => {
              if (triedQM) return
              triedQM = true
              await fetchQM()
            }

            await fetchOfficial()
            if (priority === 'qm' || (priority === 'auto' && settings.enableQQMusicLyric.value)) {
              await fetchQMOnce()
            }
            if (priority !== 'official') {
              await fetchAMLL()
            }
            if (!hasResult) {
              await fetchQMOnce()
            }
          } else {
            await fetchQM()
            if (priority !== 'official') {
              await fetchAMLL()
            }
            if (!hasResult) {
              await fetchOfficial()
            }
          }
        } else if (priority === 'qm') {
          await fetchAMLL()
          await fetchQM()
          if (!hasResult) await fetchOfficial()
        } else if (priority === 'ttml') {
          // 先尝试 AMLL DB 拿 TTML
          await fetchAMLL()
          // 无论是否拿到 TTML，都需要 lrc/trans 作为翻译来源和回退
          if (!resultData.lrc && !resultData.trans) {
            await fetchOfficial()
            if (!hasResult) await fetchQM()
          }
        } else if (priority === 'official') {
          await fetchOfficial()
          if (!hasResult) await fetchQM()
        } else {
          // 默认：AMLL → (QQ) → 官方
          await fetchAMLL()
          if (settings.enableQQMusicLyric.value) {
            await fetchQM()
          }
          await fetchOfficial()
        }

        // 跨平台升级：当前无 TTML 时尝试（有 yrc 也可升级到 ttml，有 lrc 可升级到 yrc/ttml）
        if (!resultData.ttml && (resultData.lrc || resultData.yrc || resultData.trans)) {
          const upgraded = await tryUpgradeLyric(platform, resultData, meta)
          if (upgraded) {
            hasResult = true
            emitProgress('upgrade')
          }
        }

        if (hasResult) {
          return { success: true, data: resultData }
        }

        if (platform === 'netease') {
          const metingSources = enabledSources.filter((source) => source.id.startsWith('meting-'))
          for (const metingSource of metingSources) {
            try {
              const metingUrl = `${metingSource.baseUrl}/?server=netease&type=lrc&id=${id}`
              const resp = await $fetch(metingUrl, {
                timeout: metingSource.timeout || 8000,
                headers: metingSource.headers
              })
              if (resp && typeof resp === 'string' && resp.trim()) {
                resultData.lrc = resp
                resultData.trans = ''
                resultData.yrc = ''
                resultData.ttml = ''
                emitProgress('meting')
                return {
                  success: true,
                  data: cloneLyricData(resultData)
                }
              }
            } catch (error: any) {
              console.warn(
                `[getLyrics] Meting API ${metingSource.name} 获取失败:`,
                error?.message || error
              )
            }
          }
        }

        return { success: false, error: '未获取到歌词' }
      } catch (error: any) {
        console.error('[getLyrics] 获取歌词失败:', error)
        return { success: false, error: error?.message || '未知错误' }
      }
    })()
      .then((res) => {
        if (!res.success) {
          lyricCache.delete(cacheKey)
        }
        return res
      })
      .finally(() => {
        unsubscribeProgress()
        setTimeout(() => {
          if (lyricCache.get(cacheKey) === promise) {
            lyricCache.delete(cacheKey)
          }
        }, LYRIC_CACHE_TTL)
      })

    lyricCache.set(cacheKey, promise)
    return promise
  }

  /**
   * 验证播放链接的有效性
   * @param url 播放链接
   * @returns Promise<{valid: boolean, duration?: number, error?: string}>
   */
  const validatePlayUrl = async (
    url: string
  ): Promise<{
    valid: boolean
    duration?: number
    error?: string
  }> => {
    if (!import.meta.client) {
      return {
        valid: true
      }
    }

    try {
      let validatedUrl = url
      if (url.startsWith('http://')) {
        validatedUrl = url.replace('http://', 'https://')
      }

      const exactDuration = await new Promise<number>((resolve, reject) => {
        const audio = new Audio()
        let settled = false
        const timeout = window.setTimeout(() => {
          finalize(new Error('获取音频元数据超时'))
        }, 8000)

        const cleanup = () => {
          window.clearTimeout(timeout)
          audio.onloadedmetadata = null
          audio.onerror = null
          audio.pause()
          audio.src = ''
          audio.load()
        }

        const finalize = (result: number | Error) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()

          if (result instanceof Error) {
            reject(result)
            return
          }

          resolve(result)
        }

        audio.preload = 'metadata'
        audio.onloadedmetadata = () => {
          const duration = audio.duration
          if (!Number.isFinite(duration) || duration <= 0) {
            finalize(new Error('无效的音频时长'))
            return
          }
          finalize(duration)
        }
        audio.onerror = () => {
          finalize(new Error('无法加载音频文件'))
        }
        audio.src = validatedUrl
        audio.load()
      })

      if (exactDuration < 40) {
        return {
          valid: false,
          duration: exactDuration,
          error: `歌曲实际时长过短: ${exactDuration.toFixed(1)}秒`
        }
      }

      return {
        valid: true,
        duration: exactDuration
      }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || '链接验证失败'
      }
    }
  }

  // 是否正在搜索
  const isSearching = ref(false)

  // 最后一次搜索的音源
  const lastUsedSource = ref<string>('')

  /**
   * 使用 Native Music API 搜索
   */
  const searchNativeMusic = async (params: MusicSearchParams): Promise<any[]> => {
    const platform = params.platform || 'netease'
    if (platform !== 'netease' && platform !== 'tencent') {
      return []
    }

    const endpoint = platform === 'netease' ? 'wy' : 'tx'
    const url = `/api/native-api/search/${endpoint}`
    const qqMusicCookie =
      platform === 'tencent' && import.meta.client
        ? localStorage.getItem('qq_music_cookie') || undefined
        : undefined

    try {
      console.log(`[searchNativeMusic] Requesting ${platform} search: ${params.keywords}`)
      const response: any = await $fetch(url, {
        params: {
          str: params.keywords,
          page: Math.floor((params.offset || 0) / (params.limit || 30)) + 1,
          limit: params.limit || 30,
          cookie: qqMusicCookie
        }
      })

      if (!response || !response.list) {
        return []
      }

      return response.list.map((item: any) => {
        const isNetease = platform === 'netease'
        const txSource = response.source === 'qq-music-api' ? 'qq-music-api' : 'native-tx'
        const mid = item.songmid
        const id = isNetease ? item.songmid : mid || item.songId

        return {
          id: id?.toString(),
          title: item.name,
          artist: item.singer?.replace(/、/g, '/') || '未知艺术家',
          cover: item.img,
          album: item.albumName,
          albumId: item.albumId,
          duration: isNetease ? item.duration * 1000 : item.duration, // Netease uses ms, Tencent uses s
          musicPlatform: platform,
          musicId: id?.toString(),
          url: undefined,
          hasUrl: false,
          sourceInfo: {
            source: isNetease ? 'netease-backup' : txSource,
            originalId: id?.toString(),
            originalSongId: !isNetease && item.songId ? item.songId.toString() : undefined,
            fetchedAt: new Date(),
            mid: mid,
            strMediaMid: item.strMediaMid, // Add strMediaMid
            quality: item._types, // Store quality info from LX
            types: item.types
          }
        }
      })
    } catch (error: any) {
      console.warn(`[searchNativeMusic] Failed:`, error)
      throw error
    }
  }

  // 服务器是否在中国
  const isServerInChina = ref<boolean | null>(null)

  // 检测服务器位置
  const checkServerLocation = async () => {
    if (isServerInChina.value !== null) return

    try {
      const data = await $fetch('/api/system/location')
      if (data && data.success) {
        isServerInChina.value = data.data.isInChina
        console.log(`[useMusicSources] 服务器位置检测: ${isServerInChina.value ? '中国' : '海外'}`)
      }
    } catch (e) {
      console.warn('[useMusicSources] 服务器位置检测失败，默认为海外:', e)
      isServerInChina.value = false
    }
  }

  /**
   * 搜索歌曲（带故障转移）
   */
  const searchSongs = async (
    params: MusicSearchParams,
    signal?: AbortSignal
  ): Promise<MusicSearchResult> => {
    // 检查请求是否已被取消
    if (signal?.aborted) {
      throw new DOMException('搜索请求已被取消', 'AbortError')
    }

    isSearching.value = true

    // 确保已检测服务器位置
    if (isServerInChina.value === null) {
      await checkServerLocation()
    }

    try {
      // 优先尝试 Native Music 本地集成搜索 (仅支持网易云和QQ音乐)
      // 策略调整：
      // - QQ音乐平台：无论国内外均优先 Native Music
      // - 网易云音乐平台：仅国内服务器优先 Native Music；海外跳过，直接使用第三方 API
      const platform = params.platform || 'netease'
      const shouldUseNativeFirst = platform === 'tencent' || isServerInChina.value === true

      if (
        shouldUseNativeFirst &&
        (platform === 'netease' || platform === 'tencent') &&
        params.type !== 1009
      ) {
        try {
          const reason = platform === 'tencent'
            ? '[searchSongs] QQ音乐平台，优先尝试 Native Music 搜索...'
            : '[searchSongs] 服务器位于国内，优先尝试 Native Music 搜索...'
          console.log(reason)
          const result = await searchNativeMusic(params)
          if (result && result.length > 0) {
            currentSource.value = 'native-music'
            lastUsedSource.value = platform === 'netease' ? 'netease-backup' : 'qq-resolver'
            return {
              success: true,
              source: 'native-music',
              data: result,
              error: undefined
            }
          }
        } catch (e) {
          console.warn('[searchSongs] Native Music 搜索失败，回退到其他音源:', e)
        }
      } else if (!shouldUseNativeFirst) {
        console.log(`[searchSongs] 服务器位于海外，跳过 Native Music 优先使用第三方音源`)
      }

      const enabledSources = getEnabledSources()
      const errors: any[] = []

      if (enabledSources.length === 0) {
        throw new Error('没有可用的音源')
      }

      // 根据平台选择合适的音源顺序
      let sourcesToTry: MusicSource[]

      if (params.type === 1009) {
        // 播客/电台搜索：只允许使用 netease-backup 源
        sourcesToTry = enabledSources.filter((s) => s.id.includes('netease-backup'))
        if (sourcesToTry.length === 0) {
          throw new Error('未找到支持播客搜索的音源(需网易云备用源)')
        }
      } else if (params.platform === 'bilibili') {
        const bilibiliSource = enabledSources.find((s) => s.id === 'bilibili')
        if (bilibiliSource) {
          sourcesToTry = [bilibiliSource]
        } else {
          throw new Error('未启用哔哩哔哩音源')
        }
      } else if (params.platform === 'tencent') {
        // QQ音乐平台：优先使用 vkeys v3，其次 vkeys v2；若全部失败，再尝试其他平台
        const v3 = enabledSources.find((s) => s.id === 'vkeys-v3')
        const v2 = enabledSources.find((s) => s.id === 'vkeys')
        const tencentSources: MusicSource[] = []
        if (v3) tencentSources.push(v3)
        if (v2) tencentSources.push(v2)
        console.log('QQ音乐平台搜索，优先使用 vkeys v3，失败回退到 v2')

        // 第一阶段：仅尝试腾讯专用源
        sourcesToTry = tencentSources
      } else {
        // 网易云音乐平台（默认）：优先使用netease-backup系列，vkeys作为备用
        const neteaseSources = enabledSources.filter((s) => s.id.includes('netease-backup'))
        const vkeysSource = enabledSources.find((s) => s.id === 'vkeys')
        const otherSources = enabledSources.filter(
          (s) => !s.id.includes('netease-backup') && s.id !== 'vkeys'
        )

        sourcesToTry = [...neteaseSources, ...(vkeysSource ? [vkeysSource] : []), ...otherSources]
        console.log('网易云音乐平台搜索，优先使用netease-backup系列音源')
      }

      // 按选定的顺序尝试每个音源
      for (const source of sourcesToTry) {
        // 在每次尝试前检查请求是否已被取消
        if (signal?.aborted) {
          throw new DOMException('搜索请求已被取消', 'AbortError')
        }

        try {
          console.log(`尝试使用音源: ${source.name} (${source.id})`)
          const result = await searchWithSource(source, params, signal)

          // 更新状态
          currentSource.value = source.id
          lastUsedSource.value = source.id
          updateSourceStatus(source.id, 'online')

          return {
            success: true,
            source: source.id,
            data: result,
            error: undefined
          }
        } catch (error: any) {
          console.warn(`音源 ${source.name} 搜索失败:`, error.message)
          updateSourceStatus(source.id, 'error', error.message)
          errors.push(error) // 收集错误

          // 如果不是最后一个音源，继续尝试下一个
          if (source !== sourcesToTry[sourcesToTry.length - 1]) {
            console.log(`继续尝试下一个音源...`)
          }
        }
      }

      // 若为QQ音乐平台，尝试完腾讯源后允许作为最后手段切换到其他平台
      if (params.platform === 'tencent') {
        const otherSources = enabledSources.filter((s) => s.id !== 'vkeys-v3' && s.id !== 'vkeys')
        if (otherSources.length) {
          console.log('QQ音乐平台所有专用源失败，作为最后手段尝试其他平台音源')
          for (const source of otherSources) {
            if (signal?.aborted) {
              throw new DOMException('搜索请求已被取消', 'AbortError')
            }
            try {
              console.log(`尝试使用音源: ${source.name} (${source.id})`)
              const result = await searchWithSource(source, params, signal)
              currentSource.value = source.id
              lastUsedSource.value = source.id
              updateSourceStatus(source.id, 'online')
              return { success: true, source: source.id, data: result, error: undefined }
            } catch (error: any) {
              console.warn(`音源 ${source.name} 搜索失败:`, error.message)
              updateSourceStatus(source.id, 'error', error.message)
              errors.push(error) // 收集错误
            }
          }
        }
      }

      // 所有音源都失败了
      if (errors.length > 0) {
        const errorDetails = errors.map((e) => e.message || '未知错误').join('; ')
        throw new Error(`所有音源均不可用: ${errorDetails}`)
      }
      throw new Error('所有音源均不可用，请稍后重试')
    } finally {
      isSearching.value = false
    }
  }

  /**
   * 使用指定音源搜索
   */
  const searchWithSource = async (
    source: MusicSource,
    params: MusicSearchParams,
    signal?: AbortSignal
  ): Promise<any[]> => {
    const startTime = Date.now()

    let url: string
    let transformResponse: (data: any) => any[]

    if (source.id === 'bilibili') {
      try {
        const result = await searchBilibili(params.keywords)
        updateSourceStatus(source.id, 'online', undefined, Date.now() - startTime)
        return result
      } catch (error: any) {
        updateSourceStatus(source.id, 'error', error.message, Date.now() - startTime)
        throw error
      }
    } else if (source.id === 'vkeys-v3') {
      // Vkeys v3 API（仅支持QQ音乐搜索）
      const platform = params.platform || 'tencent'
      if (platform !== 'tencent') {
        throw new Error('vkeys v3 仅支持QQ音乐搜索')
      }

      const page = Math.floor((params.offset || 0) / (params.limit || 10)) + 1
      const limit = params.limit || 10
      url = `${source.baseUrl}/tencent/search/song?keyword=${encodeURIComponent(params.keywords)}&page=${page}&limit=${limit}`
      transformResponse = (data: any) => transformVkeysV3TencentSearch(data)
    } else if (source.id === 'vkeys') {
      // Vkeys API - 根据用户选择的平台使用对应的API
      const platform = params.platform || 'netease' // 使用用户选择的平台，默认网易云

      // 根据平台使用不同的端点，都使用word参数
      if (platform === 'tencent') {
        // QQ音乐使用word参数和tencent端点
        url = `${source.baseUrl}/tencent?word=${encodeURIComponent(params.keywords)}&num=${params.limit || 30}`
      } else {
        // 网易云使用word参数和netease端点
        url = `${source.baseUrl}/netease?word=${encodeURIComponent(params.keywords)}&num=${params.limit || 30}&page=${Math.floor((params.offset || 0) / (params.limit || 30)) + 1}`
      }

      transformResponse = (data: any) => transformVkeysResponse(data, platform)
    } else if (source.id === 'netease-rrvenn') {
      url = `${source.baseUrl}/search?keyword=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}`
      transformResponse = (data: any) => {
        if (!data?.success || data?.status !== 200 || !Array.isArray(data?.data)) {
          throw new Error(`rrvenn API错误: ${data?.message || '未知错误'}`)
        }
        return data.data.map((item: any) => ({
          id: item.id,
          title: item.name,
          artist: typeof item.artists === 'string'
            ? item.artists
            : (Array.isArray(item.artists)
              ? item.artists.map((a: any) => a.name || a).join('/')
              : (item.artist_string || '未知艺术家')),
          cover: item.picUrl,
          album: item.album,
          albumId: item.albumId,
          duration: 0,
          musicPlatform: 'netease',
          musicId: item.id?.toString(),
          sourceInfo: {
            source: 'netease-rrvenn',
            originalId: item.id?.toString(),
            fetchedAt: new Date()
          }
        }))
      }
    } else {
      // 网易云备用API
      // 如果提供了cookie，添加到查询参数中
      let cookieParam = ''
      if (params.cookie) {
        // 将cookie编码后作为参数传递
        cookieParam = `&cookie=${encodeURIComponent(params.cookie)}`
      }

      // 如果是播客/电台搜索 (type === 1009)，使用 /cloudsearch 接口
      if (params.type === 1009) {
        // 播客/电台搜索接口参数：keywords=关键词, limit=数量, offset=偏移量, type=1009
        url = `${source.baseUrl}/cloudsearch?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 20}&offset=${params.offset || 0}&type=1009${cookieParam}`
        transformResponse = async (data: any) => await transformNeteaseResponse(data)
      } else {
        // 默认使用 cloudsearch 接口
        url = `${source.baseUrl}/cloudsearch?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}${cookieParam}`
        transformResponse = async (data: any) => await transformNeteaseResponse(data)
      }
    }

    let response: any
    let finalUrl = url

    try {
      console.log(`[${source.name}] 请求URL:`, finalUrl)
      // v3 请求使用简单请求，不携带任何会触发预检的自定义头
      const requestHeaders =
        source.id === 'vkeys-v3'
          ? undefined
          : ({
              'Content-Type': 'application/json',
              ...source.headers
            } as Record<string, string>)

      response = await $fetch(finalUrl, {
        timeout: source.timeout || config.value.timeout,
        signal,
        headers: requestHeaders
      })
      console.log(`[${source.name}] API响应:`, response)

      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'online', undefined, responseTime)
    } catch (error: any) {
      // 如果是网易云备用源且使用的是cloudsearch接口，尝试切换到search接口
      if (source.id !== 'vkeys' && finalUrl.includes('/cloudsearch')) {
        console.warn(`[${source.name}] cloudsearch接口失败，尝试使用search接口:`, error.message)

        // 如果提供了cookie，添加到查询参数中
        let cookieParam = ''
        if (params.cookie) {
          cookieParam = `&cookie=${encodeURIComponent(params.cookie)}`
        }

        const fallbackUrl = `${source.baseUrl}/search?keywords=${encodeURIComponent(params.keywords)}&limit=${params.limit || 30}&offset=${params.offset || 0}&type=${params.type || 1}${cookieParam}`

        try {
          console.log(`[${source.name}] 备用请求URL:`, fallbackUrl)
          response = await $fetch(fallbackUrl, {
            timeout: source.timeout || config.value.timeout,
            signal,
            headers: {
              'Content-Type': 'application/json',
              ...source.headers
            }
          })
          console.log(`[${source.name}] 备用API响应:`, response)

          const responseTime = Date.now() - startTime
          updateSourceStatus(source.id, 'online', undefined, responseTime)
          finalUrl = fallbackUrl // 更新最终使用的URL
        } catch (fallbackError: any) {
          const responseTime = Date.now() - startTime
          console.error(`[${source.name}] 备用接口也失败:`, fallbackError.message)
          updateSourceStatus(
            source.id,
            'error',
            `cloudsearch和search接口均失败: ${error.message}, ${fallbackError.message}`,
            responseTime
          )
          throw fallbackError
        }
      } else {
        const responseTime = Date.now() - startTime
        console.error(`[${source.name}] 网络请求失败:`, error.message)
        updateSourceStatus(source.id, 'error', error.message, responseTime)
        throw error
      }
    }

    // 单独处理数据转换，避免网络成功但转换失败的情况
    try {
      const result = await transformResponse(response)
      console.log(`[${source.name}] 转换后的数据:`, result)
      return result
    } catch (error: any) {
      console.error(`[${source.name}] 数据转换失败:`, error.message)
      console.error(`[${source.name}] 原始响应数据:`, response)
      throw new Error(`数据转换失败: ${error.message}`)
    }
  }

  /**
   * 获取歌曲详情
   */
  const getSongDetail = async (params: SongDetailParams): Promise<SongDetailResult> => {
    const enabledSources = getEnabledSources()

    for (const source of enabledSources) {
      try {
        const result = await getSongDetailWithSource(source, params)

        updateSourceStatus(source.id, 'online')

        return {
          success: true,
          source: source.id,
          data: { songs: result },
          error: undefined
        }
      } catch (error: any) {
        console.warn(`音源 ${source.name} 获取歌曲详情失败:`, error.message)
        updateSourceStatus(source.id, 'error', error.message)
      }
    }

    throw new Error('所有音源均不可用')
  }

  /**
   * 使用指定音源获取歌曲详情
   */
  const getSongDetailWithSource = async (
    source: MusicSource,
    params: SongDetailParams
  ): Promise<any[]> => {
    const startTime = Date.now()

    // 验证参数
    if (!params.ids || (Array.isArray(params.ids) && params.ids.length === 0)) {
      throw new Error('歌曲ID参数不能为空')
    }

    const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids

    // 再次验证处理后的ids
    if (!ids || ids === 'undefined' || ids === 'null') {
      throw new Error(`无效的歌曲ID: ${ids}`)
    }

    let url: string
    const fetchOptions: any = {
      timeout: source.timeout || config.value.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...source.headers
      }
    }
    let transformResponse: (data: any) => any[]

    if (source.id === 'vkeys') {
      // Vkeys API - 使用搜索接口，包含了歌曲详情
      // 默认使用网易云端点进行详情搜索
      url = `${source.baseUrl}/netease?word=${encodeURIComponent(ids)}&num=50`
      transformResponse = (data: any) => transformVkeysResponse(data, 'netease')
    } else if (source.id === 'netease-rrvenn') {
      const level = mapQualityToLevel(4)
      url = `${source.baseUrl}/Song_V1`
      fetchOptions.params = { url: ids, level, type: 'json' }
      transformResponse = (response: any) => {
        if (response?.status !== 200 || !response?.data) {
          throw new Error(`API响应错误: ${response.message || '未知错误'}`)
        }
        const data = response.data
        const lastLine = (data.lyric || '').split('\n').filter((l: string) => l.trim()).pop() || ''
        const match = lastLine.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/)
        let durationMs = 0
        if (match) {
          durationMs = (parseInt(match[1], 10) * 60 + parseInt(match[2], 10)) * 1000 + parseInt(match[3].padEnd(3, '0'), 10)
        }
        return [{
          id: data.id,
          title: data.name,
          artist: data.ar_name || '未知艺术家',
          cover: data.pic,
          album: data.al_name,
          duration: durationMs,
          musicPlatform: 'netease',
          musicId: data.id?.toString(),
          sourceInfo: {
            source: 'netease-rrvenn',
            originalId: data.id?.toString(),
            fetchedAt: new Date()
          }
        }]
      }
    } else {
      // 网易云备用API
      url = `${source.baseUrl}/song/detail?ids=${ids}`
      transformResponse = (response: any) => {
        if (response.code !== 200 || !response.songs) {
          throw new Error(`API响应错误: ${response.message || '未知错误'}`)
        }
        return transformNeteaseDetailResponse(response)
      }
    }

    try {
      const response = await $fetch(url, fetchOptions)

      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'online', undefined, responseTime)

      return transformResponse(response)
    } catch (error: any) {
      const responseTime = Date.now() - startTime
      updateSourceStatus(source.id, 'error', error.message, responseTime)
      throw error
    }
  }

  /**
   * 更新音源状态
   */
  const updateSourceStatus = (
    sourceId: string,
    status: SourceStatus['status'],
    errorMessage?: string,
    responseTime?: number
  ) => {
    sourceStatus.value[sourceId] = {
      status,
      responseTime,
      lastCheck: new Date(),
      errorMessage
    }
  }

  /**
   * 获取歌曲封面URL（网易云备用源）
   * 实现两步搜索：先通过歌曲ID获取详情，然后提取封面URL
   */
  const getSongPicUrl = async (id: number): Promise<string> => {
    try {
      // 获取网易云备用源
      const enabledSources = getEnabledSources()
      const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))

      if (!neteaseSource) {
        console.error('[getSongPicUrl] 未找到网易云备用源')
        return ''
      }

      // 直接调用/song/detail接口获取歌曲详情
      const response = await $fetch(`${neteaseSource.baseUrl}/song/detail`, {
        params: { ids: id },
        timeout: neteaseSource.timeout || 8000
      })

      // 从响应中提取封面URL
      return response.songs?.[0]?.al?.picUrl || ''
    } catch (error) {
      console.error('[getSongPicUrl] 获取封面失败:', error)
      return ''
    }
  }

  /**
   * 将VoiceHub音质数值映射到网易云API的level参数
   */
  const mapQualityToLevel = (quality: number): string => {
    // 根据网易云API文档映射音质等级
    switch (quality) {
      case 2:
        return 'standard' // 标准 (128k)
      case 3:
        return 'higher' // 较高 (192k)
      case 4:
        return 'exhigh' // HQ极高 (320k)
      case 5:
        return 'lossless' // SQ无损
      case 6:
        return 'hires' // Hi-Res
      case 9:
        return 'jymaster' // 超清母带
      default:
        return 'exhigh' // 默认极高音质
    }
  }

  /**
   * 获取歌曲播放URL
   * 根据平台选择合适的音源：网易云优先使用netease-backup；QQ音乐仅使用vkeys系（不跨平台）
   */
  const getSongUrl = async (
    id: number | string,
    quality?: number,
    platform?: string,
    cookie?: string,
    options?: {
      unblock?: boolean
      bilibiliCid?: string
      excludeSources?: string[]
    }
  ): Promise<{
    success: boolean
    url?: string
    source?: string
    error?: string
  }> => {
    // 特殊处理 netease-podcast 平台：使用网易云逻辑但禁用 unblock
    if (platform === 'netease-podcast') {
      platform = 'netease'
      if (!options) {
        options = {}
      }
      // 只有在未明确指定 unblock 时才强制设为 false
      if (options.unblock === undefined) {
        options.unblock = false
      }
    }

    // 如果没有提供cookie且在客户端环境，尝试从localStorage获取
    if (!cookie && import.meta.client) {
      try {
        const storedCookie = localStorage.getItem('netease_cookie')
        if (storedCookie) {
          cookie = storedCookie
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    try {
      // 获取所有启用的音源
      const enabledSources = getEnabledSources()

      // 支持多个ID的批量查询（用逗号分隔）
      let idParam = Array.isArray(id) ? id.join(',') : id.toString()

      // 如果是 bilibili 平台且 id 包含 cid，解析出来
      if (platform === 'bilibili' && !Array.isArray(id)) {
        const parsed = parseBilibiliId(id)
        idParam = parsed.bvid
        if (parsed.cid) {
          if (!options) {
            options = {}
          }
          if (!options.bilibiliCid) {
            options.bilibiliCid = parsed.cid
          }
        }
      }

      const hasNeteaseLogin = !!cookie
      const requestedQuality =
        quality !== undefined && quality !== null && quality !== '' ? Number(quality) : NaN

      // 定义音源尝试顺序
      const sourcesToTry: Array<{ source: MusicSource; type: 'netease' | 'tencent' | 'bilibili' }> =
        []

      if (platform === 'bilibili') {
        const bilibiliSource = enabledSources.find((source) => source.id === 'bilibili')
        if (bilibiliSource) {
          sourcesToTry.push({ source: bilibiliSource, type: 'bilibili' })
        }
      } else if (platform === 'tencent') {
        // QQ音乐平台：优先 vkeys v3（获取音质列表并选择可用项），然后回退到 vkeys v2

        const v3 = enabledSources.find((source) => source.id === 'vkeys-v3')
        const v2 = enabledSources.find((source) => source.id === 'vkeys')
        if (v3) {
          sourcesToTry.push({ source: v3, type: 'tencent' })
        }
        if (v2) {
          sourcesToTry.push({ source: v2, type: 'tencent' })
        }
      } else {
        // 网易云音乐平台（默认）
        const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))
        const vkeysSource = enabledSources.find((source) => source.id === 'vkeys')
        const rrvennSource = enabledSources.find((source) => source.id === 'netease-rrvenn')

        const orderedSources = hasNeteaseLogin
          ? [neteaseSource, rrvennSource, vkeysSource]
          : [rrvennSource, neteaseSource]

        for (const source of orderedSources) {
          if (source) {
            sourcesToTry.push({ source, type: 'netease' })
          }
        }

        // 添加 Meting API 备用源
        const metingSources = enabledSources.filter((source) => source.id.startsWith('meting-'))
        metingSources.forEach((source) => {
          sourcesToTry.push({ source, type: 'netease' })
        })

        // 添加其他备用音源
        const otherSources = enabledSources.filter(
          (source) =>
            source.id !== 'vkeys' &&
            source.id !== 'netease-rrvenn' &&
            !source.id.includes('netease-backup') &&
            !source.id.startsWith('meting-')
        )
        otherSources.forEach((source) => {
          sourcesToTry.push({ source, type: 'netease' })
        })

        // 未登录时，将 vkeys 作为最后的获取播放链接音源
        if (!hasNeteaseLogin && vkeysSource) {
          sourcesToTry.push({ source: vkeysSource, type: 'netease' })
        }
      }

      // 逐个尝试音源
      for (const { source, type } of sourcesToTry) {
        if (options?.excludeSources?.includes(source.id)) {
          continue
        }

        try {
          let url: string | null = null

          if (source.id === 'bilibili') {
            const result = await getBilibiliTrackUrl(idParam, options?.bilibiliCid)
            url = result.url
          } else if (source.id === 'netease-rrvenn') {
            // rrvenn API (只支持网易云)
            let neteaseQuality: number | null = null

            if (quality !== undefined && quality !== null) {
              neteaseQuality = Number(quality)
            } else {
              try {
                const { useAudioQuality } = await import('./useAudioQuality')
                const { getQuality } = useAudioQuality()
                neteaseQuality = Number(getQuality('netease'))
              } catch (error) {
              }
            }

            if (neteaseQuality === null || Number.isNaN(neteaseQuality)) {
              neteaseQuality = 4
            }

            const level = mapQualityToLevel(neteaseQuality)

            const rrvennResp = await $fetch(`${source.baseUrl}/song`, {
              params: { url: idParam, level },
              timeout: source.timeout || 8000
            })

            if (rrvennResp?.success && rrvennResp?.data?.url) {
              url = String(rrvennResp.data.url)
            }
          } else if (source.id === 'vkeys') {
            // Vkeys API
            const endpoint = type === 'tencent' ? 'tencent' : 'netease'
            const qualityCandidates =
              type === 'tencent'
                ? [!isNaN(requestedQuality) ? requestedQuality : 8]
                : [
                    ...new Set(
                      [
                        !isNaN(requestedQuality) ? requestedQuality : 0,
                        !hasNeteaseLogin && requestedQuality > 4 ? 4 : null
                      ].filter((value): value is number => typeof value === 'number')
                    )
                  ]

            for (const candidateQuality of qualityCandidates) {
              const vkeysIdParam = getVkeysIdParam(endpoint as 'netease' | 'tencent', idParam)
              const vkeysUrl = `${source.baseUrl}/${endpoint}?${vkeysIdParam.key}=${encodeURIComponent(vkeysIdParam.value)}&quality=${candidateQuality}`
              const vkeysResp = await $fetch(vkeysUrl, { timeout: source.timeout || 8000 })

              if (vkeysResp?.code === 200 && vkeysResp?.data?.url) {
                url = String(vkeysResp.data.url)
                break
              }
            }
          } else if (source.id === 'vkeys-v3') {
            // Vkeys v3：先获取歌曲信息与音质列表，再按可用音质选择并调用 v2 获取可播放URL
            try {
              const v3IdParam = getVkeysIdParam('tencent', idParam)
              const infoUrl = `${source.baseUrl}/tencent/song/info?${v3IdParam.key}=${encodeURIComponent(v3IdParam.value)}`
              const infoResp = await $fetch(infoUrl, { timeout: source.timeout || 8000 })

              // v3 成功码为 0
              if (typeof infoResp?.code !== 'number' || infoResp.code !== 0 || !infoResp?.data) {
                throw new Error(
                  `v3 歌曲信息接口错误: ${infoResp?.message || '未知错误'} (code: ${infoResp?.code})`
                )
              }

              const qualityInfo: Array<{
                type: number
                size: number
                file: string
                quality: string
              }> = infoResp.data.qualityInfo || []
              if (!Array.isArray(qualityInfo) || qualityInfo.length === 0) {
                throw new Error('v3 歌曲信息缺少音质列表')
              }

              // 目标音质：优先使用传入quality，否则读取设置
              let targetQuality: number
              const numQuality =
                quality !== undefined && quality !== null && quality !== '' ? Number(quality) : NaN

              if (!isNaN(numQuality)) {
                targetQuality = numQuality
              } else {
                try {
                  const { useAudioQuality } = await import('./useAudioQuality')
                  const { getQuality } = useAudioQuality()
                  targetQuality = Number(getQuality('tencent'))
                  if (isNaN(targetQuality)) targetQuality = 8
                } catch {
                  targetQuality = 8 // 默认 HQ 高音质
                }
              }

              // 构造腾讯音质优先序列：以目标为首，其次按 QUALITY_OPTIONS.tencent 顺序降级，最后兜底常见音质
              let fallbackList: number[] = []
              try {
                const { QUALITY_OPTIONS } = await import('./useAudioQuality')
                const optionValues =
                  (QUALITY_OPTIONS as any)?.tencent?.map((o: any) => o.value) || []
                fallbackList = optionValues.filter((v: number) => v !== targetQuality)
              } catch {
                // 兜底序列
                fallbackList = [8, 4, 10, 11, 14]
              }
              const tryQualities = [targetQuality, ...fallbackList]

              // 在 v3 音质列表中选择第一个 size>0 的可用音质
              const available = tryQualities.find((q) =>
                qualityInfo.some((qi) => qi.type === q && Number(qi.size) > 0)
              )
              const selectedQuality = available ?? targetQuality

              // 使用 vkeys v2 点歌接口获取可播放URL（v3 不直接返回 URL）
              const v2Source = getEnabledSources().find((s) => s.id === 'vkeys')
              if (!v2Source) {
                throw new Error('未配置 vkeys v2 音源以获取播放链接')
              }

              const v2IdParam = getVkeysIdParam('tencent', idParam)
              const v2Url = `${v2Source.baseUrl}/tencent?${v2IdParam.key}=${encodeURIComponent(v2IdParam.value)}&quality=${selectedQuality}`
              const v2Resp = await $fetch(v2Url, { timeout: v2Source.timeout || 8000 })
              if (v2Resp?.code === 200 && v2Resp?.data?.url) {
                url = String(v2Resp.data.url)
              } else {
                // 如果首选失败，尝试在可用音质上继续降级（排除已尝试项）
                for (const q of tryQualities.filter((q) => q !== selectedQuality)) {
                  const hasQuality = qualityInfo.some((qi) => qi.type === q && Number(qi.size) > 0)
                  if (!hasQuality) continue

                  const altUrl = `${v2Source.baseUrl}/tencent?${v2IdParam.key}=${encodeURIComponent(v2IdParam.value)}&quality=${q}`
                  const altResp = await $fetch(altUrl, { timeout: v2Source.timeout || 8000 })
                  if (altResp?.code === 200 && altResp?.data?.url) {
                    url = String(altResp.data.url)
                    break
                  }
                }
              }

              // 若仍未拿到URL，抛出错误以便外层继续按源回退
              if (!url) {
                throw new Error('v3 信息+v2 点歌未获取到有效播放链接')
              }
            } catch (error: any) {
              // vkeys v3 路径失败，继续回退其它音源
            }
          } else if (source.id.startsWith('meting-')) {
            // Meting API - 获取播放链接
            try {
              // 首先尝试获取歌曲信息，包含播放链接
              const songInfo = await getMetingSongInfo(idParam, source)

              if (songInfo.success && songInfo.data?.url) {
                // 从歌曲信息中提取播放链接
                url = songInfo.data.url
              } else {
                // 如果获取歌曲信息失败，直接使用 URL 类型的 API
                const metingUrl = `${source.baseUrl}/?server=netease&type=url&id=${idParam}`

                // 对于 Meting API，我们需要处理重定向
                const response = await fetch(metingUrl, {
                  method: 'GET',
                  headers: source.headers || {},
                  redirect: 'follow'
                })

                if (response.ok && response.url) {
                  url = response.url
                }
              }
            } catch (error: any) {
              // Meting API 获取失败，继续回退其它音源
            }
          } else {
            // 网易云备用API
            let neteaseQuality: number | null = null

            // 优先使用传入的 quality 参数
            if (quality !== undefined && quality !== null) {
              neteaseQuality = Number(quality)
            } else {
              // 否则回退到全局设置
              try {
                const { useAudioQuality } = await import('./useAudioQuality')
                const { getQuality } = useAudioQuality()
                neteaseQuality = Number(getQuality('netease'))
              } catch (error) {
                // 无法获取音质设置，使用默认音质
              }
            }

            if (
              neteaseQuality === null ||
              Number.isNaN(neteaseQuality) ||
              (!hasNeteaseLogin && neteaseQuality > 4)
            ) {
              neteaseQuality = 4
            }

            const level = mapQualityToLevel(neteaseQuality)

            // 如果提供了cookie，添加到请求参数中
            const params: any = {
              id: idParam,
              level: level,
              // 如果用户已登录（有cookie），默认不启用 unblock（false），否则启用（true）
              unblock: options?.unblock ?? (!cookie)
            }
            if (cookie) {
              params.cookie = cookie
            }

            const response = await $fetch(`${source.baseUrl}/song/url/v1`, {
              params,
              timeout: source.timeout || 8000
            })

            if (response?.code === 200 && Array.isArray(response.data) && response.data[0]?.url) {
              url = response.data[0].url as string
            }
          }

          if (url) {
            // 修复HTTP/HTTPS协议问题
            if (url.startsWith('http://')) {
              url = url.replace('http://', 'https://')
            }

            // 验证播放链接
            const validation = await validatePlayUrl(url)

            if (validation.valid) {
              return { success: true, url, source: source.id }
            } else {
              // 继续尝试下一个音源
            }
          } else {
            // 未返回有效链接，继续尝试下一个音源
          }
        } catch (error: any) {
          // 当前音源获取失败，继续尝试下一个音源
          // 继续尝试下一个音源
        }
      }

      return { success: false, error: '所有音源均无法获取有效的播放链接' }
    } catch (error: any) {
      return { success: false, error: error?.message || '未知错误' }
    }
  }

  /**
   * 获取歌词（统一调度，支持优先级策略）
   * NeteaseCloudMusicApi 优先，其次 vkeys；腾讯仅 vkeys
   */
  const getLyrics = async (
    platform: 'netease' | 'tencent',
    id: number | string,
    meta?: LyricUpgradeMeta
  ): Promise<{
    success: boolean
    data?: { lrc: string; trans?: string; yrc?: string; ttml?: string }
    error?: string
  }> => {
    return fetchLyricsWithoutUpgrade(platform, id, meta)
  }

  /**
   * 转换 Vkeys API 响应
   */
  const transformVkeysResponse = (response: any, platform: string = 'netease'): any[] => {
    console.log('[transformVkeysResponse] 开始转换数据:', { platform, response })

    if (!response) {
      console.log('[transformVkeysResponse] 响应为空')
      throw new Error('API响应为空')
    }

    // 检查错误码，非200状态码抛出错误以触发备用源重试
    if (response.code !== 200) {
      const errorMessage = `vkeys API错误: ${response.message || '未知错误'} (code: ${response.code})`
      console.log('[transformVkeysResponse] API错误:', errorMessage)
      throw new Error(errorMessage)
    }

    if (!response.data) {
      console.log('[transformVkeysResponse] 响应数据为空')
      throw new Error('API响应数据为空')
    }

    if (platform === 'tencent') {
      // QQ音乐返回数组格式
      const songs = Array.isArray(response.data) ? response.data : [response.data]
      console.log(`[transformVkeysResponse] QQ音乐处理 ${songs.length} 首歌曲`)

      return songs.map((song: any, index: number) => {
        const mid = song.mid || song.songmid || song.songMID || song.musicId || song.id
        const originalSongId =
          song.id && song.id.toString() !== mid?.toString() ? song.id.toString() : undefined
        const transformedSong = {
          id: mid?.toString(),
          title: song.song || song.name || song.title,
          artist: song.singer || song.artist || '未知艺术家',
          cover: song.cover,
          album: song.album,
          albumId: song.albumId,
          duration: song.duration || song.dt,
          musicPlatform: 'tencent',
          musicId: mid?.toString(),
          url: song.url,
          hasUrl: !!song.url,
          sourceInfo: {
            source: 'vkeys',
            originalId: mid?.toString(),
            originalSongId,
            fetchedAt: new Date(),
            mid,
            vid: song.vid,
            quality: song.quality,
            pay: song.pay,
            subtitle: song.subtitle,
            time: song.time,
            type: song.type,
            bpm: song.bpm,
            grp: song.grp
          }
        }
        console.log(`[transformVkeysResponse] QQ音乐转换歌曲 ${index + 1}:`, transformedSong)
        return transformedSong
      })
    } else {
      // 网易云返回数组格式
      const songs = Array.isArray(response.data) ? response.data : [response.data]
      console.log(`[transformVkeysResponse] 网易云处理 ${songs.length} 首歌曲`)

      return songs.map((song: any, index: number) => {
        const transformedSong = {
          id: song.id,
          title: song.song,
          artist: song.singer || '未知艺术家',
          cover: song.cover?.trim(), // 去除可能的空格
          album: song.album,
          albumId: song.albumId,
          duration: song.interval || song.time, // 网易云使用interval字段表示时长，备用time字段
          musicPlatform: 'netease',
          musicId: song.id?.toString(),
          url: song.url, // 添加vkeys API返回的播放链接
          hasUrl: !!song.url, // 标记是否有播放链接
          sourceInfo: {
            source: 'vkeys',
            originalId: song.id?.toString(),
            fetchedAt: new Date(),
            quality: song.quality,
            size: song.size,
            kbps: song.kbps,
            url: song.url,
            link: song.link,
            time: song.time
          }
        }
        console.log(`[transformVkeysResponse] 网易云转换歌曲 ${index + 1}:`, transformedSong)
        return transformedSong
      })
    }
  }

  /**
   * 转换 Vkeys v3 QQ音乐搜索响应
   * 文档: https://doc.vkeys.cn/v3/音乐模块/QQ音乐/搜索相关接口/2-song.html
   */
  const transformVkeysV3TencentSearch = (response: any): any[] => {
    if (!response) throw new Error('API响应为空')
    if (typeof response.code !== 'number') throw new Error('响应缺少状态码')

    // v3 成功码为 0
    if (response.code !== 0) {
      const msg = `vkeys v3 API错误: ${response.message || '未知错误'} (code: ${response.code})`
      throw new Error(msg)
    }

    const data = response.data
    if (!data || !Array.isArray(data.list)) {
      throw new Error('v3 响应数据格式不正确')
    }

    return data.list.map((item: any) => {
      const mid = item.songMID ?? item.mid
      const originalSongId = item.songID ?? item.songId ?? item.id
      const id = mid ?? originalSongId
      const duration = item.interval ?? item.duration
      return {
        id: id?.toString(),
        title: item.title,
        artist: Array.isArray(item.singerList)
          ? item.singerList.map((s: any) => s.name).join('/')
          : item.singer || '',
        cover: item.albumImage || item.cover || '',
        album: item.album || '',
        albumId: item.albumID ?? item.albumId,
        duration,
        musicPlatform: 'tencent',
        musicId: id?.toString(),
        url: undefined,
        hasUrl: false,
        sourceInfo: {
          source: 'vkeys-v3',
          originalId: id?.toString(),
          originalSongId: originalSongId?.toString(),
          fetchedAt: new Date(),
          mid,
          vid: item.vid,
          quality: item.quality,
          pay: item.pay,
          subtitle: item.subtitle,
          time: item.time,
          type: item.type,
          bpm: item.bpm,
          grp: item.grp
        }
      }
    })
  }

  /**
   * 转换网易云 API 搜索响应
   * 实现两步搜索：处理搜索结果，然后批量获取歌曲详情和封面
   */
  const transformNeteaseResponse = async (response: any): Promise<any[]> => {
    console.log('[transformNeteaseResponse] 开始转换数据:', response)

    // 检查响应是否存在
    if (!response) {
      throw new Error('API响应为空')
    }

    // 检查API响应状态码
    if (response.code !== undefined && response.code !== 200) {
      throw new Error(`API响应错误: ${response.message || '未知错误'} (code: ${response.code})`)
    }

    // 尝试获取结果列表，支持多种类型（单曲、电台、声音等）
    const result = response.result || response.data
    if (!result) {
      throw new Error('API响应格式错误: 缺少result/data字段')
    }

    let items =
      result.songs || result.djRadios || result.resources || result.voices || result.list || []

    // 如果是声音搜索(type=2000)，结果可能在 data.resources 或 data.list 中
    if (!items || items.length === 0) {
      if (result.data?.resources) {
        items = result.data.resources
      } else if (result.list) {
        items = result.list
      } else if (Array.isArray(result)) {
        items = result
      }
    }

    if (!Array.isArray(items)) {
      console.error('[transformNeteaseResponse] 无效的响应结构:', {
        keys: Object.keys(result),
        itemsType: typeof items
      })
      // 如果找不到列表但也不是错误，可能就是没结果
      return []
    }

    console.log(`[transformNeteaseResponse] 找到 ${items.length} 个结果`)

    if (items.length === 0) {
      return []
    }

    // 检查是否是歌曲类型的完整信息
    // 只有当 items 是 songs 且包含 al.picUrl 时才认为是完整信息的歌曲
    const isSongType = !!result.songs
    const hasCompleteInfo = isSongType && items.some((item: any) => item.al?.picUrl)
    console.log(
      `[transformNeteaseResponse] 结果类型: ${isSongType ? '歌曲' : '其他'}, 完整信息: ${hasCompleteInfo}`
    )

    let detailResponse: any = null
    const detailMap = new Map()

    // 如果是search接口响应的歌曲（缺少完整信息），则需要获取详情
    if (isSongType && !hasCompleteInfo) {
      // 获取网易云备用源
      const enabledSources = getEnabledSources()
      const neteaseSource = enabledSources.find((source) => source.id.includes('netease-backup'))

      if (neteaseSource) {
        // 提取所有歌曲ID，准备批量获取详情
        const songIds = items.map((song: any) => song.id).filter((id: any) => id)
        console.log(`[transformNeteaseResponse] 准备批量获取 ${songIds.length} 首歌曲的详情`)

        if (songIds.length > 0) {
          try {
            // 批量获取歌曲详情，包含封面信息
            detailResponse = await $fetch(`${neteaseSource.baseUrl}/song/detail`, {
              params: { ids: songIds.join(',') },
              timeout: neteaseSource.timeout || 8000
            })
            console.log(`[transformNeteaseResponse] 批量获取详情成功`)
          } catch (error) {
            console.warn(
              '[transformNeteaseResponse] 批量获取详情失败，将使用搜索结果的基本信息:',
              error
            )
          }
        }

        // 创建详情映射，方便查找
        if (detailResponse?.songs) {
          detailResponse.songs.forEach((song: any) => {
            detailMap.set(song.id, song)
          })
        }
      }
    }

    // 转换搜索结果，根据接口类型使用不同的数据提取策略
    return items
      .map((item: any, index: number) => {
        try {
          let id = item.id
          let title = item.name
          let cover: string | null = null
          let artist: string = '未知艺术家'
          let album: string | undefined
          let albumId: string | number | undefined
          let duration: number = 0
          let musicId = item.id?.toString()

          // 处理不同类型的数据结构
          if (isSongType) {
            // 歌曲类型处理
            if (hasCompleteInfo) {
              // cloudsearch接口响应，包含完整信息
              cover = item.al?.picUrl || null
              artist = item.ar?.map((a: any) => a.name).join('/') || '未知艺术家'
              album = item.al?.name
              albumId = item.al?.id
              duration = item.dt || 0
            } else {
              // search接口响应，需要从详情中获取信息
              const detail = detailMap.get(item.id)
              cover =
                detail?.al?.picUrl ||
                (item.album?.picId
                  ? `https://p1.music.126.net/${item.album.picId}/${item.album.picId}.jpg`
                  : null)
              artist = item.artists?.map((a: any) => a.name).join('/') || '未知艺术家'
              album = item.album?.name
              albumId = item.album?.id || detail?.al?.id
              duration = item.duration || 0
            }
          } else {
            // 其他类型（如声音、电台等）
            // 尝试适配声音/播客结构
            const baseInfo = item.baseInfo || item

            // 优先使用 mainSong.id (声音) 或 mainTrackId (电台节目) 作为歌曲ID，以便能通过 song/url 接口播放
            // 如果都没有，才使用 baseInfo.id (节目ID)
            const songId = baseInfo.mainSong?.id || baseInfo.mainTrackId || baseInfo.id
            id = songId || id

            title = baseInfo.name || title
            cover = baseInfo.coverUrl || baseInfo.picUrl || item.picUrl || null

            // 尝试获取艺术家/主播信息
            if (baseInfo.dj) {
              artist = baseInfo.dj.nickname
            } else if (item.dj) {
              artist = item.dj.nickname
            } else if (baseInfo.artist) {
              artist = baseInfo.artist.name
            }

            // 尝试获取专辑/电台信息
            if (baseInfo.radio) {
              album = baseInfo.radio.name
            } else if (item.radio) {
              album = item.radio.name
            }

            duration = baseInfo.duration || item.duration || 0

            // 声音ID
            musicId = id?.toString()
          }

          const transformedSong = {
            id: id,
            title: title,
            artist,
            cover,
            album,
            albumId,
            duration,
            musicPlatform: isSongType ? 'netease' : 'netease-podcast',
            musicId: musicId,
            sourceInfo: {
              source: 'netease-backup',
              originalId: musicId,
              fetchedAt: new Date(),
              hasDetail: hasCompleteInfo || !!detailMap.get(item.id),
              interface: hasCompleteInfo ? 'cloudsearch' : 'search',
              type: isSongType ? 'song' : 'voice'
            }
          }
          // 只打印前几个结果，避免日志过多
          if (index < 3) {
            console.log(`[transformNeteaseResponse] 转换结果 ${index + 1}:`, transformedSong)
          }
          return transformedSong
        } catch (error: any) {
          console.error(
            `[transformNeteaseResponse] 转换第 ${index + 1} 个结果失败:`,
            error.message,
            item
          )
          // 不抛出错误，而是跳过该项
          return null
        }
      })
      .filter((item: any) => item !== null)
  }

  /**
   * 转换网易云 API 详情响应
   */
  const transformNeteaseDetailResponse = (response: any): any[] => {
    return response.songs.map((song: any) => ({
      id: song.id,
      title: song.name,
      artist: song.ar?.map((artist: any) => artist.name).join('/') || '未知艺术家',
      cover: song.al?.picUrl,
      album: song.al?.name,
      duration: song.dt,
      fee: song.fee,
      privilege: song.privilege,
      musicPlatform: 'netease',
      musicId: song.id.toString(),
      sourceInfo: {
        source: 'netease-backup',
        originalId: song.id.toString(),
        fetchedAt: new Date()
      }
    }))
  }

  /**
   * 获取音源状态摘要
   */
  const getSourceStatusSummary = computed(() => {
    const summary = {
      total: config.value.sources.length,
      online: 0,
      offline: 0,
      error: 0,
      unknown: 0
    }

    config.value.sources.forEach((source) => {
      const status = sourceStatus.value[source.id]
      if (!status) {
        summary.unknown++
      } else {
        summary[status.status]++
      }
    })

    return summary
  })

  /**
   * 获取当前音源信息
   */
  const getCurrentSourceInfo = computed(() => {
    const source = getSourceById(currentSource.value)
    const status = sourceStatus.value[currentSource.value]

    return {
      source,
      status,
      isHealthy: status?.status === 'online'
    }
  })

  /**
   * 获取电台/播客节目列表
   */
  const getDjPrograms = async (
    radioId: string | number,
    limit: number = 20,
    offset: number = 0,
    cookie?: string
  ): Promise<{
    success: boolean
    programs: any[]
    count: number
    more: boolean
    error?: string
  }> => {
    const enabledSources = getEnabledSources()
    // 优先使用网易云备用源
    const neteaseSources = enabledSources.filter((source) => source.id.includes('netease-backup'))

    // 如果没有找到网易云备用源，尝试其他可能支持的源（虽然目前只有备用源支持此接口）
    if (neteaseSources.length === 0) {
      return {
        success: false,
        programs: [],
        count: 0,
        more: false,
        error: '未找到可用的网易云音源'
      }
    }

    // 尝试所有网易云源
    for (const source of neteaseSources) {
      try {
        let cookieParam = ''
        if (cookie) {
          cookieParam = `&cookie=${encodeURIComponent(cookie)}`
        }

        const url = `${source.baseUrl}/dj/program?rid=${radioId}&limit=${limit}&offset=${offset}${cookieParam}`
        console.log(`[getDjPrograms] Requesting: ${url}`)

        const response: any = await $fetch(url, {
          timeout: source.timeout || 8000
        })

        if (response.code === 200) {
          return {
            success: true,
            programs: response.programs || [],
            count: response.count || 0,
            more: response.more || false
          }
        }
      } catch (e: any) {
        console.warn(`[getDjPrograms] Source ${source.id} failed:`, e.message)
      }
    }

    return { success: false, programs: [], count: 0, more: false, error: '获取节目列表失败' }
  }

  return {
    // 状态
    config: readonly(config),
    currentSource: readonly(currentSource),
    sourceStatus: readonly(sourceStatus),
    isSearching: readonly(isSearching),
    lastUsedSource: readonly(lastUsedSource),

    // 计算属性
    sourceStatusSummary: getSourceStatusSummary,
    currentSourceInfo: getCurrentSourceInfo,

    // 方法
    searchSongs,
    getSongDetail,
    getSongUrl,
    getLyrics,
    getMetingSongInfo,
    updateSourceStatus,
    validatePlayUrl,
    getDjPrograms
  }
}
