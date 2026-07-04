import { computed, readonly, ref } from 'vue'
import { cleanTTMLTranslations, parseQRCLyric, parseSmartLrc } from '~/utils/lyric/lyricParser'
import { parseTTML, parseYrc } from '@applemusic-like-lyrics/lyric'
import { useAudioPlayer } from './useAudioPlayer'
import { useMusicSources } from './useMusicSources'

export interface ParsedLyricLine {
  time: number
  content: string
  words?: Array<{
    time: number
    duration: number
    content: string
  }>
}

type ParsedLyricWord = NonNullable<ParsedLyricLine['words']>[number]

export interface LyricData {
  lrc: string
  trans?: string
  yrc?: string
  ttml?: string
}

// ─── 内部解析工具 ────────────────────────────────────────────────

/**
 * 将 @applemusic-like-lyrics/lyric 库返回的 lines 数组统一转换为
 * ParsedLyricLine[]，兼容 TTML / YRC / SmartLrc 三种来源。
 */
const convertLibraryLines = (lines: any[]): ParsedLyricLine[] => {
  return lines
    .map((line): ParsedLyricLine | null => {
      const words: ParsedLyricWord[] | undefined = Array.isArray(line?.words)
        ? line.words
            .map((word: any): ParsedLyricWord | null => {
              const startTime = typeof word?.startTime === 'number' ? word.startTime : 0
              const endTime =
                typeof word?.endTime === 'number'
                  ? word.endTime
                  : startTime + (typeof word?.duration === 'number' ? word.duration : 0)
              const content =
                typeof word?.word === 'string' ? word.word : String(word?.content ?? '')
              if (!content) return null
              return { time: startTime, duration: Math.max(endTime - startTime, 0), content }
            })
            .filter((w: ParsedLyricWord | null): w is ParsedLyricWord => w !== null)
        : undefined

      const content =
        words?.map((w) => w.content).join('') ||
        (typeof line?.content === 'string' ? line.content : '')

      const time =
        typeof line?.startTime === 'number' ? line.startTime : (line?.time ?? 0)

      if (!content && (!words || words.length === 0)) return null
      return { time, content, words: words && words.length > 0 ? words : undefined }
    })
    .filter((l): l is ParsedLyricLine => l !== null)
    .sort((a, b) => a.time - b.time)
}

const hasWordByWord = (lines: ParsedLyricLine[]): boolean =>
  lines.some((l) => (l.words?.length ?? 0) > 1)

/**
 * 尝试将单段文本解析为歌词行。
 * 优先级：TTML > QRC > YRC(JSON) > SmartLrc
 */
const parseFlexibleLyrics = (
  text: string
): { lines: ParsedLyricLine[]; wordByWord: boolean } => {
  const raw = text?.trim()
  if (!raw) return { lines: [], wordByWord: false }

  // TTML（XML 开头）
  if (raw.startsWith('<')) {
    // 先尝试 TTML
    try {
      const parsed = parseTTML(cleanTTMLTranslations(raw))
      const ttmlLines = convertLibraryLines((parsed as any)?.lines ?? [])
      if (ttmlLines.length > 0) {
        return { lines: ttmlLines, wordByWord: hasWordByWord(ttmlLines) }
      }
    } catch {
      // 解析失败继续尝试 QRC
    }

    // QRC（QQ 音乐 XML 格式）
    if (
      raw.includes('LyricContent="') ||
      raw.includes('<lyric') ||
      raw.includes('<LrcContent')
    ) {
      try {
        const qrcLines = convertLibraryLines(parseQRCLyric(raw))
        if (qrcLines.length > 0) {
          return { lines: qrcLines, wordByWord: hasWordByWord(qrcLines) }
        }
      } catch {
        // 继续回退
      }
    }
  }

  // YRC（网易云 JSON 逐字格式）
  if (raw.startsWith('{') || raw.trim().split('\n')[0]?.trimStart().startsWith('{')) {
    try {
      const lines = parseYrc(raw)
      if (lines && lines.length > 0) {
        const converted = convertLibraryLines(lines)
        if (converted.length > 0) {
          return { lines: converted, wordByWord: hasWordByWord(converted) }
        }
      }
    } catch {
      // 回退到 SmartLrc
    }
  }

  // SmartLrc（通用 LRC / 逐字扩展 LRC）
  const { lines: smartLines, format } = parseSmartLrc(raw)
  if (smartLines.length > 0) {
    const converted = convertLibraryLines(smartLines)
    return {
      lines: converted,
      wordByWord: hasWordByWord(converted) || format !== 'line'
    }
  }

  return { lines: [], wordByWord: false }
}

/**
 * 按优先级顺序尝试多个候选文本，返回第一个成功解析的结果。
 * 外部调用时按 [ttml, yrc, lrc] 顺序传入。
 */
const parseBestLyrics = (
  candidates: Array<string | undefined | null>
): { lines: ParsedLyricLine[]; wordByWord: boolean } => {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue
    const parsed = parseFlexibleLyrics(candidate)
    if (parsed.lines.length > 0) return parsed
  }
  return { lines: [], wordByWord: false }
}

// ─── Composable ────────────────────────────────────────────────

export const useLyrics = () => {
  const audioPlayer = useAudioPlayer()

  const currentLyrics = ref<ParsedLyricLine[]>([])
  const translationLyrics = ref<ParsedLyricLine[]>([])
  const wordByWordLyrics = ref<ParsedLyricLine[]>([])
  const currentLyricIndex = ref(0)
  const currentTime = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const showTranslation = ref(false)
  const showWordByWord = ref(false)

  // 竞态令牌
  let currentToken = 0

  // ─── 通知 HarmonyOS ────────────────────────────────────────────

  const notifyHarmonyOSLyricsUpdate = (lyrics: string) => {
    if (typeof window === 'undefined') return
    if (!window.HarmonyOS?.postMessage) {
      console.warn('[useLyrics] 鸿蒙侧消息接口不可用')
      return
    }
    try {
      window.HarmonyOS.postMessage(
        JSON.stringify({ method: 'updateLyrics', parameters: { lyrics } })
      )
    } catch (e) {
      console.error('[useLyrics] 通知鸿蒙侧失败:', e)
    }
  }

  // ─── 歌词获取 ────────────────────────────────────────────────

  const applyLyricData = (lyricData: LyricData): boolean => {
    // 主歌词：按优先级 ttml > yrc > lrc 解析
    const parsedMain = parseBestLyrics([lyricData.ttml, lyricData.yrc, lyricData.lrc])
    if (parsedMain.lines.length === 0) return false

    currentLyrics.value = parsedMain.lines
    wordByWordLyrics.value = parsedMain.wordByWord ? parsedMain.lines : []
    showWordByWord.value = parsedMain.wordByWord

    translationLyrics.value = []
    showTranslation.value = false

    // 翻译歌词
    if (lyricData.trans) {
      const parsedTrans = parseBestLyrics([lyricData.trans])
      if (parsedTrans.lines.length > 0) {
        translationLyrics.value = parsedTrans.lines
        showTranslation.value = true
      }
    }

    error.value = null
    return true
  }

  const fetchLyrics = async (
    platform: string,
    musicId: string,
    meta?: { title?: string; artist?: string; album?: string }
  ): Promise<void> => {
    if (!platform || !musicId) {
      console.error('[useLyrics] fetchLyrics 参数错误:', { platform, musicId })
      error.value = '缺少必要参数'
      _resetState()
      return
    }

    const token = ++currentToken
    isLoading.value = true
    error.value = null
    _resetState()
    let hasRenderedProgress = false

    try {
      const { getLyrics } = useMusicSources()
      const currentSong = audioPlayer.getCurrentSong().value as any
      const result = await getLyrics(platform as 'netease' | 'tencent', musicId, {
        title: meta?.title ?? currentSong?.title ?? '',
        artist: meta?.artist ?? currentSong?.artist ?? '',
        album: meta?.album ?? currentSong?.album ?? '',
        duration: currentSong?.duration,
        onProgress: ({ data }) => {
          if (token !== currentToken) return
          const applied = applyLyricData(data)
          if (!applied) return

          hasRenderedProgress = true
          isLoading.value = false
          notifyHarmonyOSLyricsUpdate(getFormattedLyricsForHarmonyOS())
        }
      })

      if (token !== currentToken) return

      if (!result.success || !result.data) {
        throw new Error(result.error || '未获取到歌词')
      }

      const lyricData = result.data

      const applied = applyLyricData(lyricData)
      if (!applied && !hasRenderedProgress) {
        throw new Error('未获取到歌词')
      }

      const harmonyLyrics = getFormattedLyricsForHarmonyOS()
      notifyHarmonyOSLyricsUpdate(harmonyLyrics)

      error.value = null
    } catch (e: any) {
      if (token !== currentToken) return
      if (hasRenderedProgress) {
        error.value = null
        return
      }
      console.error('[useLyrics] 获取歌词失败:', e?.message ?? e)
      error.value = e?.message ?? '获取歌词失败'
      _resetState()
      notifyHarmonyOSLyricsUpdate('')
    } finally {
      if (token === currentToken) {
        isLoading.value = false
      }
    }
  }

  // ─── 时间同步 ────────────────────────────────────────────────

  const updateCurrentLyricIndex = (time: number): void => {
    currentTime.value = time
    const lyricList = currentLyrics.value
    if (lyricList.length === 0) return

    // 二分查找当前时间所在行
    let lo = 0
    let hi = lyricList.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lyricList[mid].time <= time) lo = mid
      else hi = mid - 1
    }

    if (currentLyricIndex.value !== lo) {
      currentLyricIndex.value = lo
    }
  }

  // ─── 计算属性 ────────────────────────────────────────────────

  const currentLyricContent = computed(() => {
    const lyricList = currentLyrics.value
    if (lyricList.length === 0 || currentLyricIndex.value >= lyricList.length) return ''
    return lyricList[currentLyricIndex.value].content
  })

  const currentTranslationContent = computed(() => {
    if (!showTranslation.value || translationLyrics.value.length === 0) return ''
    const refTime = currentLyrics.value[currentLyricIndex.value]?.time
    if (refTime == null) return ''

    const list = translationLyrics.value
    let lo = 0
    let hi = list.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (list[mid].time <= refTime) lo = mid
      else hi = mid - 1
    }
    return list[lo]?.time <= refTime ? list[lo].content : ''
  })

  // ─── 格式化工具 ────────────────────────────────────────────────

  const _formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const centiseconds = Math.floor((ms % 1000) / 10)
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`
  }

  const getFormattedLrcText = (): string => {
    if (currentLyrics.value.length === 0) return '[00:00.00]暂无歌词'
    return currentLyrics.value
      .map((line) => `${_formatTime(line.time)}${line.content}`)
      .join('\r\n')
  }

  const getFormattedLyricsForHarmonyOS = (): string => {
    if (currentLyrics.value.length === 0) return '[00:00.00]暂无歌词'

    const MAX_BYTES = 40960
    const encoder = new TextEncoder()
    const lines = currentLyrics.value
    const parts: string[] = []
    let byteCount = 0

    for (const line of lines) {
      const lineText = `${_formatTime(line.time)}${line.content}\r\n`
      const lineBytes = encoder.encode(lineText).length
      // 留 100 字节缓冲
      if (byteCount + lineBytes > MAX_BYTES - 100) break
      parts.push(lineText)
      byteCount += lineBytes
    }

    return parts.join('').trimEnd()
  }

  // ─── 清理 ────────────────────────────────────────────────────

  const _resetState = () => {
    currentLyrics.value = []
    translationLyrics.value = []
    wordByWordLyrics.value = []
    currentLyricIndex.value = 0
    showTranslation.value = false
    showWordByWord.value = false
  }

  const clearLyrics = (): void => {
    currentToken++
    _resetState()
    currentTime.value = 0
    error.value = null
  }

  const seekToLyricLine = (index: number): number => {
    if (index >= 0 && index < currentLyrics.value.length) {
      return currentLyrics.value[index].time / 1000
    }
    return 0
  }

  // 保留向后兼容的解析方法（部分组件可能直接调用）
  const parseLrcLyrics = (lrcText: string): ParsedLyricLine[] => {
    if (!lrcText) return []
    return parseFlexibleLyrics(lrcText).lines
  }

  const parseYrcLyrics = (yrcText: string): ParsedLyricLine[] => {
    if (!yrcText) return []
    return parseFlexibleLyrics(yrcText).lines
  }

  return {
    currentLyrics: readonly(currentLyrics),
    translationLyrics: readonly(translationLyrics),
    wordByWordLyrics: readonly(wordByWordLyrics),
    currentLyricIndex: readonly(currentLyricIndex),
    currentTime: readonly(currentTime),
    isLoading: readonly(isLoading),
    error: readonly(error),

    showTranslation,
    showWordByWord,

    currentLyricContent,
    currentTranslationContent,

    fetchLyrics,
    updateCurrentLyricIndex,
    getFormattedLrcText,
    getFormattedLyricsForHarmonyOS,
    notifyHarmonyOSLyricsUpdate,
    clearLyrics,
    seekToLyricLine,
    parseLrcLyrics,
    parseYrcLyrics
  }
}
