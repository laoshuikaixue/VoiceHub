import { computed, ref } from 'vue'

// 歌词行接口
export interface ParsedLyricLine {
  time: number // 时间戳（毫秒）
  content: string // 歌词内容
  words?: Array<{
    // 逐字歌词（可选）
    time: number
    duration: number
    content: string
  }>
}

// 歌词数据接口
export interface LyricData {
  lrc: string // 普通歌词
  trans?: string // 翻译歌词
  yrc?: string // 逐字歌词
}

export const useLyrics = () => {
  // 响应式状态
  const currentLyrics = ref<ParsedLyricLine[]>([])
  const translationLyrics = ref<ParsedLyricLine[]>([])
  const wordByWordLyrics = ref<ParsedLyricLine[]>([])
  const currentLyricIndex = ref(0)
  const currentTime = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 歌词显示设置
  const showTranslation = ref(false)
  const showWordByWord = ref(false)

  // 解析LRC格式歌词
  const parseLrcLyrics = (lrcText: string): ParsedLyricLine[] => {
    if (!lrcText) return []

    const lines = lrcText.split('\n')
    const lyrics: ParsedLyricLine[] = []

    for (const line of lines) {
      // 匹配时间标签 [mm:ss.xx] 或 [mm:ss:xx]
      const timeMatch = line.match(/\[(\d{2}):(\d{2})[.:](\d{2,3})\](.*)/)
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1])
        const seconds = parseInt(timeMatch[2])
        const milliseconds = parseInt(timeMatch[3].padEnd(3, '0'))
        const content = timeMatch[4].trim()

        const time = minutes * 60 * 1000 + seconds * 1000 + milliseconds

        if (content) {
          // 只添加有内容的歌词行
          lyrics.push({ time, content })
        }
      }
    }

    return lyrics.sort((a, b) => a.time - b.time)
  }

  // 解析网易云逐字歌词
  const parseYrcLyrics = (yrcText: string): ParsedLyricLine[] => {
    if (!yrcText) return []

    const lines = yrcText.split('\n')
    const lyrics: ParsedLyricLine[] = []

    for (const line of lines) {
      try {
        // 网易云逐字歌词格式：{"t":12420,"c":[{"tx":"ya ","t":290},{"tx":"la ","t":380}]}
        if (line.startsWith('{')) {
          const data = JSON.parse(line)
          if (typeof data.t === 'number' && Array.isArray(data.c)) {
            const start = data.t
            let accTime = start
            const words = data.c.map((word: any) => {
              const d = typeof word.t === 'number' ? word.t : 0 // t 为毫秒时长
              const wContent = typeof word.tx === 'string' ? word.tx : ''
              const wTime = accTime
              accTime += d
              return {
                time: wTime,
                duration: d,
                content: wContent
              }
            })

            const content = data.c
              .map((word: any) => (typeof word.tx === 'string' ? word.tx : ''))
              .join('')
            lyrics.push({
              time: start,
              content,
              words
            })
          }
        }
        // 方括号 + 括号 的逐字格式
        else if (line.includes('[')) {
          // 示例 A（绝对时间在括号前）：[12420,3470](12420,290,0)ya (12710,380,0)la
          // 示例 B（相对时间在括号后）：[0,4690]嘘(0,293)つ(293,293)き(586,293)
          const timeMatch = line.match(/\[(\d+),(\d+)\](.*)/)
          if (!timeMatch) continue

          const startTime = parseInt(timeMatch[1])
          const duration = parseInt(timeMatch[2])
          const wordsText = timeMatch[3]

          const words: Array<{ time: number; duration: number; content: string }> = []

          // 解析示例 B：字(相对或绝对时间, 时长) —— 单位均为毫秒
          for (const wordMatch of wordsText.matchAll(/([^()]+)\((\d+),(\d+)\)/g)) {
            const content = wordMatch[1]
            const t = parseInt(wordMatch[2])
            const durMs = parseInt(wordMatch[3])
            // 如果时间小于行起始时间，视为相对时间；否则视为绝对时间
            const absTime = startTime > 0 && t < startTime ? startTime + t : t
            words.push({
              time: absTime,
              duration: durMs,
              content
            })
          }

          // 若上面未匹配到，则解析示例 A： (绝对时间, 时长, 0)字 —— 单位为毫秒
          if (words.length === 0) {
            for (const wordMatch of wordsText.matchAll(/\((\d+),(\d+),\d+\)([^()]*)/g)) {
              const absTime = parseInt(wordMatch[1])
              const durMs = parseInt(wordMatch[2])
              const content = wordMatch[3]
              words.push({
                time: absTime,
                duration: durMs,
                content
              })
            }
          }

          const content = words.map((w) => w.content).join('')
          if (content.length > 0) {
            lyrics.push({
              time: startTime,
              content,
              words
            })
          }
        }
      } catch (e) {
        console.warn('解析逐字歌词行失败:', line, e)
      }
    }

    return lyrics.sort((a, b) => a.time - b.time)
  }

  // 统一调度后，移除旧的备用源歌词获取逻辑

  // 统一调度后，移除旧的网易云逐字歌词解析函数（现统一用 parseYrcLyrics）

  // 获取歌词（统一调度：先备用源，再vkeys）
  const fetchLyrics = async (platform: string, musicId: string): Promise<void> => {
    if (!platform || !musicId) {
      console.error('fetchLyrics 参数错误:', { platform, musicId })
      error.value = '缺少必要参数'
      currentLyrics.value = []
      translationLyrics.value = []
      wordByWordLyrics.value = []
      currentLyricIndex.value = 0
      notifyHarmonyOSLyricsUpdate('')
      return
    }

    isLoading.value = true
    error.value = null

    currentLyrics.value = []
    translationLyrics.value = []
    wordByWordLyrics.value = []
    currentLyricIndex.value = 0
    notifyHarmonyOSLyricsUpdate('')

    try {
      const { getLyrics } = useMusicSources()
      const result = await getLyrics(platform as 'netease' | 'tencent', musicId)

      if (result.success && result.data) {
        const lyricData = result.data

        // 优先使用逐字歌词
        if (lyricData.yrc) {
          wordByWordLyrics.value = parseYrcLyrics(lyricData.yrc)
          currentLyrics.value = wordByWordLyrics.value
        } else if (lyricData.lrc) {
          currentLyrics.value = parseLrcLyrics(lyricData.lrc)
        } else {
          currentLyrics.value = []
        }

        // 翻译歌词
        if (lyricData.trans) {
          translationLyrics.value = parseLrcLyrics(lyricData.trans)
          showTranslation.value = true
        } else {
          translationLyrics.value = []
          showTranslation.value = false
        }

        const harmonyLyrics = getFormattedLyricsForHarmonyOS()
        notifyHarmonyOSLyricsUpdate(harmonyLyrics)

        error.value = null
        isLoading.value = false
        return
      } else {
        throw new Error(result.error || '未获取到歌词')
      }
    } catch (e: any) {
      console.error('获取歌词失败:', e?.message || e)
      error.value = e?.message || '获取歌词失败'

      currentLyrics.value = []
      translationLyrics.value = []
      wordByWordLyrics.value = []
      currentLyricIndex.value = 0
      notifyHarmonyOSLyricsUpdate('')
    } finally {
      isLoading.value = false
    }
  }

  // 通知鸿蒙侧歌词更新的辅助函数
  const notifyHarmonyOSLyricsUpdate = (lyrics: string) => {
    if (typeof window !== 'undefined' && window.HarmonyOS && window.HarmonyOS.postMessage) {
      try {
        const message = {
          method: 'updateLyrics',
          parameters: {
            lyrics: lyrics
          }
        }
        window.HarmonyOS.postMessage(JSON.stringify(message))
        // 通知鸿蒙侧更新歌词
      } catch (error) {
        console.error('通知鸿蒙侧更新歌词失败:', error)
      }
    } else {
      console.warn('鸿蒙侧消息接口不可用，无法更新歌词')
    }
  }

  // 根据当前时间更新歌词索引
  const updateCurrentLyricIndex = (time: number): void => {
    currentTime.value = time

    const lyrics = currentLyrics.value
    if (lyrics.length === 0) {
      // 没有歌词数据
      return
    }

    // 找到当前时间对应的歌词行
    for (let i = 0; i < lyrics.length; i++) {
      if (time >= lyrics[i].time && (i === lyrics.length - 1 || time < lyrics[i + 1].time)) {
        if (currentLyricIndex.value !== i) {
          // 歌词索引更新
          currentLyricIndex.value = i
        }
        return
      }
    }

    // 未找到匹配的歌词行
  }

  // 获取当前歌词内容
  const currentLyricContent = computed(() => {
    const lyrics = currentLyrics.value
    if (lyrics.length === 0 || currentLyricIndex.value >= lyrics.length) {
      return ''
    }
    return lyrics[currentLyricIndex.value].content
  })

  // 获取当前翻译歌词
  const currentTranslationContent = computed(() => {
    if (!showTranslation.value || translationLyrics.value.length === 0) {
      return ''
    }

    const currentTime = currentLyrics.value[currentLyricIndex.value]?.time
    if (!currentTime) return ''

    // 找到对应时间的翻译歌词
    for (let i = 0; i < translationLyrics.value.length; i++) {
      if (
        currentTime >= translationLyrics.value[i].time &&
        (i === translationLyrics.value.length - 1 ||
          currentTime < translationLyrics.value[i + 1].time)
      ) {
        return translationLyrics.value[i].content
      }
    }
    return ''
  })

  // 获取格式化的LRC歌词文本
  const getFormattedLrcText = (): string => {
    if (currentLyrics.value.length === 0) {
      return '[00:00.00]暂无歌词'
    }

    return currentLyrics.value
      .map((line) => {
        const minutes = Math.floor(line.time / 60000)
        const seconds = Math.floor((line.time % 60000) / 1000)
        const milliseconds = Math.floor((line.time % 1000) / 10)

        const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
        return `${timeStr}${line.content}`
      })
      .join('\r\n')
  }

  // 获取格式化的歌词用于鸿蒙侧，符合AVMetadata.lyric要求
  const getFormattedLyricsForHarmonyOS = (): string => {
    if (currentLyrics.value.length === 0) {
      return '[00:00.00]暂无歌词'
    }

    // 按照鸿蒙侧要求格式化歌词：[mm:ss.xx]歌词内容\r\n
    let formattedLyrics = currentLyrics.value
      .map((line) => {
        const minutes = Math.floor(line.time / 60000)
        const seconds = Math.floor((line.time % 60000) / 1000)
        const milliseconds = Math.floor((line.time % 1000) / 10)

        // 格式：[mm:ss.xx]歌词内容
        const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
        return `${timeStr}${line.content}`
      })
      .join('\r\n')

    // 鸿蒙侧字符串长度限制：<40960字节
    const maxBytes = 40960
    const encoder = new TextEncoder()

    // 检查字符串长度是否超过限制
    if (encoder.encode(formattedLyrics).length > maxBytes) {
      console.warn('歌词长度超过鸿蒙侧限制，正在截断...')

      // 逐行添加歌词，直到接近字节限制
      let truncatedLyrics = ''
      for (const line of currentLyrics.value) {
        const minutes = Math.floor(line.time / 60000)
        const seconds = Math.floor((line.time % 60000) / 1000)
        const milliseconds = Math.floor((line.time % 1000) / 10)

        const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}]`
        const lineText = `${timeStr}${line.content}\r\n`

        // 检查添加这一行后是否会超过限制
        const testLyrics = truncatedLyrics + lineText
        if (encoder.encode(testLyrics).length > maxBytes - 100) {
          // 留100字节缓冲
          break
        }

        truncatedLyrics += lineText
      }

      formattedLyrics = truncatedLyrics.trim()
    }

    // 歌词格式化完成
    return formattedLyrics
  }

  // 清空歌词
  const clearLyrics = (): void => {
    currentLyrics.value = []
    translationLyrics.value = []
    wordByWordLyrics.value = []
    currentLyricIndex.value = 0
    currentTime.value = 0
    error.value = null
  }

  // 跳转到指定歌词行
  const seekToLyricLine = (index: number): number => {
    if (index >= 0 && index < currentLyrics.value.length) {
      return currentLyrics.value[index].time / 1000 // 返回秒数
    }
    return 0
  }

  return {
    // 状态
    currentLyrics: readonly(currentLyrics),
    translationLyrics: readonly(translationLyrics),
    wordByWordLyrics: readonly(wordByWordLyrics),
    currentLyricIndex: readonly(currentLyricIndex),
    currentTime: readonly(currentTime),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // 设置
    showTranslation,
    showWordByWord,

    // 计算属性
    currentLyricContent,
    currentTranslationContent,

    // 方法
    fetchLyrics,
    updateCurrentLyricIndex,
    getFormattedLrcText,
    getFormattedLyricsForHarmonyOS, // 保持向后兼容
    notifyHarmonyOSLyricsUpdate, // 鸿蒙侧歌词更新通知
    clearLyrics,
    seekToLyricLine,
    parseLrcLyrics,
    parseYrcLyrics
  }
}
