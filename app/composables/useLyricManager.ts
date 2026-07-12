import { computed, ref, watch } from 'vue'
import { useAudioPlayer } from './useAudioPlayer'
import { useMusicSources } from './useMusicSources'
import { useLyricSettings } from './useLyricSettings'
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

export const useLyricManager = () => {
  const audioPlayer = useAudioPlayer()
  const { composableErrors } = useLocale()
  const lyricMessages = computed(() => composableErrors.value.lyrics)
  const { getLyrics } = useMusicSources()
  const settings = useLyricSettings()

  const lyrics = ref<LyricLine[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentTrackId = ref<string | null>(null)
  const hasTranslation = ref(false)
  const hasRoma = ref(false)
  const lyricFormat = ref<LrcFormat | 'ttml' | 'qrc'>('line')

  // 竞态令牌：每次新请求递增，旧请求收到结果后与当前令牌比对，不一致则丢弃
  let currentToken = 0

  const clearLyrics = () => {
    lyrics.value = []
    error.value = null
    hasTranslation.value = false
    hasRoma.value = false
    currentTrackId.value = null
    lyricFormat.value = 'line'
  }

  const applyLyricData = (
    track: any,
    lyricData: { lrc?: string; trans?: string; yrc?: string; ttml?: string } | null | undefined,
    sourceLabel: string
  ) => {
    if (!lyricData) return false

    const { lrc, trans, yrc, ttml } = lyricData
    console.log(
      `[LyricManager] ${sourceLabel} 获取结果: LRC=${!!lrc}, TRANS=${!!trans}, YRC=${!!yrc}, TTML=${!!ttml}`
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
    if (trans && format !== 'ttml') {
      const { lines: transLines } = parseSmartLrc(trans)
      if (transLines.length > 0) {
        parsedLyrics = alignLyrics(parsedLyrics, transLines, 'translatedLyric')
        hasTranslation.value = true
        console.log('[LyricManager] 已对齐翻译')
      }
    }

    const metadata = {
      title: track.title,
      artists: track.artist ? [track.artist] : undefined
    }

    lyrics.value = formatLyric(parsedLyrics, settings, metadata)
    lyricFormat.value = format
    error.value = null
    console.log(`[LyricManager] 解析完成，格式=${format}，行数=${lyrics.value.length}`)
    return true
  }

  const fetchLyric = async (track: any) => {
    if (!track?.id) return

    const trackId = track.id.toString()

    // 已有歌词且非新歌曲，直接复用
    if (currentTrackId.value === trackId && lyrics.value.length > 0) return

    // 开启新令牌，使所有进行中的旧请求失效
    const token = ++currentToken
    currentTrackId.value = trackId
    loading.value = true
    error.value = null
    hasTranslation.value = false
    hasRoma.value = false
    lyricFormat.value = 'line'
    let hasRenderedProgress = false

    try {
      const platform = track.musicPlatform || 'netease'
      const musicId = track.musicId || track.id

      console.log(`[LyricManager] 开始获取歌词: ${track.title} (${platform}:${musicId})`)

      const result = await getLyrics(platform, musicId, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        onProgress: ({ data, stage }) => {
          if (token !== currentToken) return
          const applied = applyLyricData(track, data, `阶段 ${stage}`)
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

      const applied = applyLyricData(track, result.data, '最终')
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

  return {
    lyrics,
    loading,
    error,
    currentTrackId,
    hasTranslation,
    hasRoma,
    lyricFormat,
    fetchLyric,
    clearLyrics
  }
}
