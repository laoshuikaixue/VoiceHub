import { computed, effectScope, ref, watch, type EffectScope } from 'vue'
import { useAudioPlayer } from './useAudioPlayer'
import { useMusicSources } from './useMusicSources'
import { useLyricSettings } from './useLyricSettings'
import { useLocale } from '~/utils/locale'
import {
  parseSmartLrc,
  alignLyrics,
  cleanTTMLTranslations,
  parseQRCLyric,
  type LrcFormat
} from '~/utils/lyric/lyricParser'
import { formatLyric } from '~/utils/lyric/lyricFormat'
import type { LyricLine } from '@applemusic-like-lyrics/lyric'
import { parseTTML, parseYrc } from '@applemusic-like-lyrics/lyric'

/** 模块级共享状态：AMLyric 与 DefaultLyric 各自调用 useLyricManager 时共享同一份数据 */
const sharedLyrics = ref<LyricLine[]>([])
const sharedLoading = ref(false)
const sharedError = ref<string | null>(null)
const sharedCurrentTrackId = ref<string | null>(null)
const sharedHasTranslation = ref(false)
const sharedHasRoma = ref(false)
const sharedLyricFormat = ref<LrcFormat | 'ttml' | 'qrc'>('line')
/** 当前歌词实际使用的来源（用于界面展示与问题定位） */
const sharedLyricSource = ref<string>('')

// 竞态令牌：每次新请求递增，旧请求收到结果后与当前令牌比对，不一致则丢弃
let currentToken = 0

// 全局 watch 只注册一次（detached scope 脱离组件生命周期，避免组件卸载后停止同步）
let managerScope: EffectScope | null = null

export const useLyricManager = () => {
  const audioPlayer = useAudioPlayer()
  const { composableErrors } = useLocale()
  const lyricMessages = computed(() => composableErrors.value.lyrics)
  const { getLyrics } = useMusicSources()
  const settings = useLyricSettings()

  const lyrics = sharedLyrics
  const loading = sharedLoading
  const error = sharedError
  const currentTrackId = sharedCurrentTrackId
  const hasTranslation = sharedHasTranslation
  const hasRoma = sharedHasRoma
  const lyricFormat = sharedLyricFormat
  const lyricSource = sharedLyricSource

  const clearLyrics = () => {
    lyrics.value = []
    error.value = null
    hasTranslation.value = false
    hasRoma.value = false
    currentTrackId.value = null
    lyricFormat.value = 'line'
    lyricSource.value = ''
  }

  /**
   * 推断歌词实际来源：
   * ttml → AMLL DB；逐字 QRC → QQ；其余按抓取阶段与平台映射
   */
  const inferLyricSource = (
    format: LrcFormat | 'ttml' | 'qrc',
    stage: string,
    track: any
  ): string => {
    const platform = track?.musicPlatform || 'netease'
    if (format === 'ttml') return 'amll'
    if (format === 'qrc') return 'qm'
    if (stage === 'upgrade') {
      // 跨平台升级：数据来自对侧平台
      return platform === 'netease' ? 'qm' : 'official'
    }
    if (stage === 'meting') return 'meting'
    if (stage === 'amll') return 'amll'
    if (stage === 'qm') {
      // netease 平台的 qm 阶段走 vkeys 第三方接口
      return platform === 'netease' ? 'vkeys' : 'qm'
    }
    // official 阶段 / 最终结果按平台保守推断
    return platform === 'tencent' ? 'qm' : 'official'
  }

  const applyLyricData = (
    track: any,
    lyricData: {
      lrc?: string
      trans?: string
      yrc?: string
      ttml?: string
      ytrans?: string
    } | null | undefined,
    sourceLabel: string,
    stage: string
  ) => {
    if (!lyricData) return false

    const { lrc, trans, yrc, ttml, ytrans } = lyricData
    console.log(
      `[LyricManager] ${sourceLabel} 获取结果: LRC=${!!lrc}, TRANS=${!!trans}, YRC=${!!yrc}, TTML=${!!ttml}, YTRANS=${!!ytrans}`
    )

    let parsedLyrics: LyricLine[] = []
    let format: LrcFormat | 'ttml' | 'qrc' = 'line'

    // 优先级：TTML > YRC/QRC > LRC
    if (settings.enableOnlineTTMLLyric.value && ttml) {
      try {
        const cleaned = cleanTTMLTranslations(ttml)
        const parsed = parseTTML(cleaned)
        const lines = (parsed as any)?.lines ?? []
        if (lines.length > 0) {
          parsedLyrics = lines
          format = 'ttml'
          console.log('[LyricManager] 使用 TTML 格式')
        }
      } catch (e) {
        console.warn('[LyricManager] TTML 解析失败，回退', e)
      }
    }

    if (parsedLyrics.length === 0 && yrc) {
      // QRC：QQ音乐 XML 格式
      if (yrc.trim().startsWith('<') || yrc.includes('LyricContent="')) {
        try {
          const qrcLines = parseQRCLyric(yrc, trans, undefined)
          if (qrcLines.length > 0) {
            parsedLyrics = qrcLines
            format = 'qrc'
            console.log('[LyricManager] 使用 QRC 格式')
          }
        } catch (e) {
          console.warn('[LyricManager] QRC 解析失败', e)
        }
      }

      // YRC：网易云 JSON 逐字格式
      if (parsedLyrics.length === 0) {
        try {
          const lines = parseYrc(yrc)
          if (lines && lines.length > 0) {
            const validLines = lines.filter((l) => l.words && l.words.length > 0)
            if (validLines.length > 0) {
              parsedLyrics = lines
              format = 'word-by-word'
              console.log('[LyricManager] 使用 YRC 格式')
            }
          }
        } catch {
          // parseYrc 失败时回退 parseSmartLrc
        }

        // parseYrc 无效，用 SmartLrc 兜底
        if (parsedLyrics.length === 0) {
          const { lines, format: detectedFormat } = parseSmartLrc(yrc)
          if (lines.length > 0) {
            parsedLyrics = lines
            format = detectedFormat
            console.log(`[LyricManager] 使用 YRC→SmartLrc 格式 (${detectedFormat})`)
          }
        }
      }
    }

    if (parsedLyrics.length === 0 && lrc) {
      const { lines, format: detectedFormat } = parseSmartLrc(lrc)
      parsedLyrics = lines
      format = detectedFormat
      console.log(`[LyricManager] 使用 LRC 格式 (${detectedFormat})`)
    }

    if (parsedLyrics.length === 0) return false

    hasTranslation.value = false
    hasRoma.value = false

    // 对齐翻译（TTML 已内嵌翻译，不需要再 align）
    if (format !== 'ttml') {
      // ytrans（ytlrc）时间戳与逐字主歌词行边界一致，优先于普通 tlyric
      const transText = ytrans || trans
      if (transText) {
        const { lines: transLines } = parseSmartLrc(transText)
        if (transLines.length > 0) {
          parsedLyrics = alignLyrics(parsedLyrics, transLines, 'translatedLyric')
          hasTranslation.value = true
          console.log(`[LyricManager] 已对齐翻译 (来源: ${ytrans ? 'ytlrc' : 'tlyric'})`)
        }
      }
    }

    const metadata = {
      title: track.title,
      artists: track.artist ? [track.artist] : undefined
    }

    lyrics.value = formatLyric(parsedLyrics, settings, metadata)
    lyricFormat.value = format
    // 推断实际歌词来源（用于来源徽章展示与问题定位）
    lyricSource.value = inferLyricSource(format, stage, track)
    error.value = null
    console.log(`[LyricManager] 解析完成，格式=${format}，行数=${lyrics.value.length}`)
    return true
  }

  const fetchLyric = async (track: any, options?: { force?: boolean }) => {
    if (!track?.id) return

    const trackId = track.id.toString()

    // 已有歌词且非新歌曲，直接复用（force 用于切换歌词来源后强制重拉）
    if (!options?.force && currentTrackId.value === trackId && lyrics.value.length > 0) return

    // 开启新令牌，使所有进行中的旧请求失效
    const token = ++currentToken
    currentTrackId.value = trackId
    loading.value = true
    error.value = null
    hasTranslation.value = false
    hasRoma.value = false
    lyricFormat.value = 'line'
    lyricSource.value = ''
    let hasRenderedProgress = false

    const priority = settings.lyricPriority.value

    try {
      const platform = track.musicPlatform || 'netease'
      const musicId = track.musicId || track.id

      console.log(`[LyricManager] 开始获取歌词: ${track.title} (${platform}:${musicId})`)

      const result = await getLyrics(platform, musicId, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        priority,
        onProgress: ({ data, stage }) => {
          if (token !== currentToken) return
          const applied = applyLyricData(track, data, `阶段 ${stage}`, stage)
          if (applied) {
            hasRenderedProgress = true
            loading.value = false
          }
        }
      })

      // 令牌失效：歌曲已切换，丢弃结果
      if (token !== currentToken) return

      if (!result.success || !result.data) {
        throw new Error(result.error || lyricMessages.value.notFound)
      }

      // 令牌二次校验（getLyrics 为异步，期间可能切歌）
      if (token !== currentToken) return

      const applied = applyLyricData(track, result.data, '最终', '最终')
      if (!applied && !hasRenderedProgress) {
        error.value = lyricMessages.value.unavailable
        lyrics.value = []
      }
    } catch (e: any) {
      if (token !== currentToken) return
      if (hasRenderedProgress) {
        error.value = null
        return
      }
      console.error('[LyricManager] 获取歌词失败:', e)
      error.value = e.message || lyricMessages.value.fetchFailed
      lyrics.value = []
    } finally {
      // 只有当前令牌的请求才更新 loading 状态
      if (token === currentToken) {
        loading.value = false
      }
    }
  }

  if (!managerScope) {
    managerScope = effectScope(true)
    managerScope.run(() => {
      watch(
        () => audioPlayer.getCurrentSong().value,
        (newTrack, oldTrack) => {
          // 歌曲切换（包括 id 变化和从有到无）
          const newId = newTrack?.id?.toString() ?? null
          const oldId = oldTrack?.id?.toString() ?? null
          if (newId === oldId) return

          if (newTrack) {
            fetchLyric(newTrack)
          } else {
            currentToken++ // 使正在进行的请求失效
            clearLyrics()
          }
        },
        { immediate: true }
      )
    })
  }

  return {
    lyrics,
    loading,
    error,
    currentTrackId,
    hasTranslation,
    hasRoma,
    lyricFormat,
    lyricSource,
    fetchLyric,
    clearLyrics
  }
}
