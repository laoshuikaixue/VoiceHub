import { cloneDeep } from 'lodash-es'
import type { LyricLine } from '@applemusic-like-lyrics/lyric'
import { parseTTML as parseTTMLLib } from '@applemusic-like-lyrics/lyric'
import { extractLyricContent } from './qrc-parser'
import { getLineText } from './lyricText'
import { parseLrc, parseTimeToMs } from './parseLrc'

/**
 * LRC 格式类型
 */
export enum LrcFormat {
  /** 普通逐行 LRC */
  Line = 'line',
  /** 逐字 LRC：[00:28.850]曲[00:32.455]：[00:36.060]钱 */
  WordByWord = 'word-by-word',
  /** 增强型 LRC (ESLyric)：[01:37.305]<01:37.624>怕<01:37.943>你 */
  Enhanced = 'enhanced'
}

/** LyricWord 类型 */
type LyricWord = { word: string; startTime: number; endTime: number; romanWord: string }

// 预编译正则表达式（时间戳分钟位 1-2 位，需与 parseLrc 保持一致）
const META_TAG_REGEX = /^\[[a-z]+:/i
const FORMAT_DETECT_TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})\.(\d{1,})\]/g
const ENHANCED_TIME_TAG_REGEX = /<(\d{1,2}):(\d{2})\.(\d{1,})>/
// 移除全局带状态的正则，改为在函数内使用 matchAll 或重新构建
const LINE_TIME_REGEX = /^\[(\d{1,2}):(\d{2})\.(\d{1,})\]/

// QRC 解析相关正则 - 提前编译
const QRC_LINE_PATTERN = /^\[(\d+),(\d+)\](.*)$/
const QRC_WORD_PATTERN = /([^(]*)\((\d+),(\d+)\)/g

const DEFAULT_WORD_DURATION = 1000
const ALIGN_TOLERANCE_MS = 300
/** 二次最近邻对齐的漂移容差：兜底时间轴整体漂移较大的来源 */
const DRIFT_TOLERANCE_MS = 1500

/**
 * 创建 LyricWord 对象
 */
const createWord = (word: string, startTime: number, endTime: number = startTime): LyricWord => ({
  word,
  startTime,
  endTime,
  romanWord: ''
})

/**
 * 创建 LyricLine 对象
 */
const createLine = (words: LyricWord[], startTime: number, endTime: number = 0): LyricLine => ({
  words,
  startTime,
  endTime,
  translatedLyric: '',
  romanLyric: '',
  isBG: false,
  isDuet: false
})

/**
 * 检测 LRC 格式类型
 */
export const detectLrcFormat = (content: string): LrcFormat => {
  const lines = content.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || META_TAG_REGEX.test(line)) continue
    // 检查增强型LRC
    if (ENHANCED_TIME_TAG_REGEX.test(line)) {
      return LrcFormat.Enhanced
    }
    // 检查逐字LRC
    const matches = line.match(FORMAT_DETECT_TIME_TAG_REGEX)
    if (matches && matches.length > 1) {
      return LrcFormat.WordByWord
    }
  }
  return LrcFormat.Line
}

/**
 * 解析逐字 LRC 格式
 * 优化：在解析过程中直接计算 endTime，避免二次遍历
 */
export const parseWordByWordLrc = (content: string): LyricLine[] => {
  const result: LyricLine[] = []
  let prevLine: LyricLine | null = null
  const WORD_BY_WORD_PATTERN = /\[(\d{1,2}):(\d{2})\.(\d{1,})\]([^[\\]]*)/g

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || META_TAG_REGEX.test(line)) continue

    const words: LyricWord[] = []
    let lineStartTime = Infinity

    let prevWord: LyricWord | null = null

    const matches = line.matchAll(WORD_BY_WORD_PATTERN)

    for (const match of matches) {
      const startTime = parseTimeToMs(match[1], match[2], match[3])
      const wordText = match[4]

      if (!wordText && words.length === 0) continue

      lineStartTime = Math.min(lineStartTime, startTime)

      // 设置上一个字的结束时间
      if (prevWord) {
        prevWord.endTime = startTime
      }

      if (wordText) {
        const newWord = createWord(wordText, startTime)
        words.push(newWord)
        prevWord = newWord
      }
    }

    // 处理行内最后一个字
    if (prevWord) {
      prevWord.endTime = prevWord.startTime + DEFAULT_WORD_DURATION
    }

    if (words.length > 0) {
      const lineObj = createLine(words, lineStartTime === Infinity ? 0 : lineStartTime)
      // 设置行结束时间为最后一个字的结束时间
      lineObj.endTime = words[words.length - 1].endTime

      // 修正上一行的结束时间 (Single Pass)
      if (prevLine) {
        const prevLastWord = prevLine.words[prevLine.words.length - 1]
        // 只有当当前行开始时间晚于上一行最后一个字的开始时间时，才进行截断
        if (lineObj.startTime > prevLastWord.startTime) {
          prevLastWord.endTime = Math.min(prevLastWord.endTime, lineObj.startTime)
          prevLine.endTime = prevLastWord.endTime
        }
      }

      result.push(lineObj)
      prevLine = lineObj
    }
  }

  return result
}

/**
 * 解析增强型 LRC 格式 (ESLyric)
 */
export const parseEnhancedLrc = (content: string): LyricLine[] => {
  const result: LyricLine[] = []
  let prevLine: LyricLine | null = null
  const ENHANCED_WORD_PATTERN = /<(\d{1,2}):(\d{2})\.(\d{1,})>([^<]*)/g

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || META_TAG_REGEX.test(line)) continue

    const lineTimeMatch = LINE_TIME_REGEX.exec(line)
    if (!lineTimeMatch) continue

    const lineStartTime = parseTimeToMs(lineTimeMatch[1], lineTimeMatch[2], lineTimeMatch[3])
    const contentAfterTime = line.slice(lineTimeMatch[0].length)

    const words: LyricWord[] = []

    // 检查是否有增强型标记
    if (ENHANCED_TIME_TAG_REGEX.test(contentAfterTime)) {
      let prevWord: LyricWord | null = null

      const matches = contentAfterTime.matchAll(ENHANCED_WORD_PATTERN)

      for (const match of matches) {
        const startTime = parseTimeToMs(match[1], match[2], match[3])
        const wordText = match[4]

        if (prevWord) {
          prevWord.endTime = startTime
        }

        if (wordText) {
          const newWord = createWord(wordText, startTime)
          words.push(newWord)
          prevWord = newWord
        }
      }

      if (prevWord) {
        prevWord.endTime = prevWord.startTime + DEFAULT_WORD_DURATION // 默认兜底
      }
    } else {
      // 无增强型标记，作为整行处理
      const text = contentAfterTime.trim()
      if (text) {
        words.push(createWord(text, lineStartTime, lineStartTime + DEFAULT_WORD_DURATION)) // 默认持续1s
      }
    }

    if (words.length > 0) {
      const lineObj = createLine(words, lineStartTime)
      lineObj.endTime = words[words.length - 1].endTime

      // 修正上一行的结束时间 (Single Pass)
      if (prevLine) {
        const prevLastWord = prevLine.words[prevLine.words.length - 1]
        if (lineObj.startTime > prevLastWord.startTime) {
          prevLastWord.endTime = Math.min(prevLastWord.endTime, lineObj.startTime)
          prevLine.endTime = prevLastWord.endTime
        }
      }

      result.push(lineObj)
      prevLine = lineObj
    }
  }

  return result
}

/**
 * 智能解析 LRC 歌词
 */
export const parseSmartLrc = (content: string): { format: LrcFormat; lines: LyricLine[] } => {
  const format = detectLrcFormat(content)

  let lines: LyricLine[]
  switch (format) {
    case LrcFormat.WordByWord:
      lines = parseWordByWordLrc(content)
      break
    case LrcFormat.Enhanced:
      lines = parseEnhancedLrc(content)
      break
    default:
      lines = parseLrc(content) || []
  }

  console.log(`[LyricParser] 检测到歌词格式: ${format}, 共 ${lines.length} 行`)
  return { format, lines }
}

/**
 * 判断解析结果是否为逐字格式
 */
export const isWordLevelFormat = (format: LrcFormat): boolean =>
  format === LrcFormat.WordByWord || format === LrcFormat.Enhanced

/**
 * 计算主歌词行与参照行的时间轴匹配关系
 * 两阶段策略：
 * 1. 双指针严格匹配（容差 300ms），行数不一致时按时间方向跳跃
 * 2. 对第一轮未命中的主行，与剩余未使用的参照行做最近邻匹配（容差放宽到 1500ms）
 *    兜底时间轴整体漂移较大的来源（vkeys、第三方翻译 LRC 等），
 *    避免个别行漂移导致大面积内容丢失
 * @param lyrics 主歌词行
 * @param others 参照行，必须已按 startTime 升序
 * @returns matchIndexes[i] 为第 i 行匹配到的 others 下标，未命中为 null
 */
const matchLyricLines = (
  lyrics: Readonly<LyricLine[]>,
  others: Readonly<LyricLine[]>
): Array<number | null> => {
  const matchIndexes: Array<number | null> = new Array(lyrics.length).fill(null)
  const used = new Set<number>()

  let i = 0
  let j = 0
  while (i < lyrics.length && j < others.length) {
    const main = lyrics[i]
    const other = others[j]
    if (!main || !other) break
    const diff = main.startTime - other.startTime
    if (Math.abs(diff) <= ALIGN_TOLERANCE_MS) {
      matchIndexes[i] = j
      used.add(j)
      i++
      j++
    } else if (diff < 0) {
      i++
    } else {
      j++
    }
  }

  for (let m = 0; m < lyrics.length; m++) {
    if (matchIndexes[m] !== null) continue
    const main = lyrics[m]
    if (!main) continue
    let bestK = -1
    let bestDiff = Infinity
    for (let k = 0; k < others.length; k++) {
      if (used.has(k)) continue
      const other = others[k]
      if (!other) continue
      const diff = Math.abs(main.startTime - other.startTime)
      if (diff < bestDiff) {
        bestDiff = diff
        bestK = k
      }
    }
    if (bestK !== -1 && bestDiff <= DRIFT_TOLERANCE_MS) {
      matchIndexes[m] = bestK
      used.add(bestK)
    }
  }
  return matchIndexes
}

/** 按 startTime 升序返回副本，部分解析路径（逐字 LRC）不保证输出有序 */
const sortByStartTime = (lines: Readonly<LyricLine[]>): LyricLine[] =>
  [...lines].sort((a, b) => a.startTime - b.startTime)

/**
 * 歌词内容对齐（翻译等行级文本）
 * @param lyrics 歌词数据 (Readonly)
 * @param otherLyrics 其他歌词数据
 * @param key 对齐类型
 * @returns 对齐后的歌词数据 (新副本)
 */
export const alignLyrics = (
  lyrics: Readonly<LyricLine[]>,
  otherLyrics: Readonly<LyricLine[]>,
  key: 'translatedLyric' | 'romanLyric'
): LyricLine[] => {
  if (!lyrics.length || !otherLyrics.length) return cloneDeep(lyrics) as LyricLine[]

  const result = cloneDeep(lyrics) as LyricLine[]
  const others = sortByStartTime(otherLyrics)

  matchLyricLines(result, others).forEach((idx, i) => {
    const target = result[i]
    const source = idx === null ? undefined : others[idx]
    if (target && source) target[key] = getLineText(source)
  })
  return result
}

/**
 * 音译（罗马音）对齐
 * 参照行是逐字、且单词数与主歌词逐字数一致时额外写入 word.romanWord（逐字音译）；
 * 两种形态都保留在数据里，由显示层决定用哪一种（AMLL 会同时渲染两者，必须在其裁剪）
 * @returns 对齐后的歌词数据 (新副本)
 */
export const alignRomanization = (
  lyrics: Readonly<LyricLine[]>,
  romaLines: Readonly<LyricLine[]>
): LyricLine[] => {
  if (!lyrics.length || !romaLines.length) return cloneDeep(lyrics) as LyricLine[]

  const result = cloneDeep(lyrics) as LyricLine[]
  const others = sortByStartTime(romaLines)

  matchLyricLines(result, others).forEach((idx, i) => {
    const line = result[i]
    const romaLine = idx === null ? undefined : others[idx]
    if (!line || !romaLine) return
    const romaWords = romaLine.words
    const lineText = getLineText(romaLine)
    if (!lineText.trim()) return

    line.romanLyric = lineText
    // 单词数为 1 的参照行没有可用的逐字时间轴，只作整行处理
    if (romaWords.length > 1 && romaWords.length === line.words.length) {
      line.words.forEach((word, wi) => {
        const romaWord = romaWords[wi]
        if (romaWord) word.romanWord = romaWord.word
      })
    }
  })
  return result
}

/** QRC 单行解析结果 */
type QrcLine = {
  startTime: number
  endTime: number
  words: Array<{ word: string; startTime: number; endTime: number }>
}

/**
 * 解析 QRC 内容为行数据
 */
const parseQRCContent = (rawContent: string): QrcLine[] => {
  // 使用策略模式提取 LyricContent (自动适配 Browser/Node 环境)
  const content = extractLyricContent(rawContent) || rawContent

  const result: QrcLine[] = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // 跳过元数据标签 [ti:xxx] [ar:xxx] 等
    if (META_TAG_REGEX.test(line)) continue

    const lineMatch = QRC_LINE_PATTERN.exec(line)
    if (!lineMatch) continue

    const lineStart = parseInt(lineMatch[1], 10)
    const lineDuration = parseInt(lineMatch[2], 10)
    const lineContent = lineMatch[3]

    // 解析逐字
    const words: Array<{ word: string; startTime: number; endTime: number }> = []

    const matches = lineContent.matchAll(QRC_WORD_PATTERN)

    for (const match of matches) {
      const wordText = match[1]
      const wordStart = parseInt(match[2], 10)
      const wordDuration = parseInt(match[3], 10)

      if (wordText) {
        words.push({
          word: wordText,
          startTime: wordStart,
          endTime: wordStart + wordDuration
        })
      }
    }

    if (words.length > 0) {
      result.push({
        startTime: lineStart,
        endTime: lineStart + lineDuration,
        words
      })
    }
  }
  return result
}

/** QrcLine → LyricLine，保留逐字时间轴 */
const qrcLineToLyricLine = (line: QrcLine): LyricLine => ({
  words: line.words.map((word) => createWord(word.word, word.startTime, word.endTime)),
  startTime: line.startTime,
  endTime: line.endTime,
  translatedLyric: '',
  romanLyric: '',
  isBG: false,
  isDuet: false
})

/**
 * 解析音译（罗马音）原始内容
 * QRC（XML）与 YRC（[ms,dur] 文本）保留逐字时间轴，其余按 LRC 解析
 */
export const parseRomanizationContent = (roma: string): LyricLine[] => {
  const isWordLevel =
    roma.trim().startsWith('<') || roma.includes('LyricContent="') || /^\[\d+,\d+\]/m.test(roma)
  if (isWordLevel) {
    const parsed = parseQRCContent(roma).map(qrcLineToLyricLine)
    if (parsed.length) return parsed
  }
  return parseSmartLrc(roma).lines
}

/**
 * 解析 QQ 音乐 QRC 格式歌词
 * @param qrcContent QRC 原始内容
 * @param trans 翻译歌词
 * @param roma 罗马音歌词（逐字 QRC/YRC 或普通 LRC）
 * @returns LyricLine 数组
 */
export const parseQRCLyric = (qrcContent: string, trans?: string, roma?: string): LyricLine[] => {
  // 解析主歌词
  let result: LyricLine[] = parseQRCContent(qrcContent).map(qrcLineToLyricLine)

  // 处理翻译
  if (trans) {
    // parseSmartLrc 兼容 1 位毫秒时间戳与逐字变体，比 parseLrc 更稳
    let { lines: transLines } = parseSmartLrc(trans)
    if (transLines?.length) {
      // 过滤包含 "//" 或 "作品的著作权" 的翻译行
      transLines = transLines.filter((line) => {
        const text = getLineText(line)
        return !text.includes('//') && !text.includes('作品的著作权')
      })
      result = alignLyrics(result, transLines, 'translatedLyric')
    }
  }

  // 处理音译
  if (roma) {
    const romaLines = parseRomanizationContent(roma)
    if (romaLines.length) result = alignRomanization(result, romaLines)
  }

  return result
}

/**
 * 清洗 TTML 中不需要的翻译
 * @param ttmlContent 原始 TTML 内容
 * @returns 清洗后的 TTML 内容
 */
export const cleanTTMLTranslations = (ttmlContent: string): string => {
  const lang_counter = (ttml_text: string) => {
    // 使用正则匹配所有 xml:lang="xx-XX" 格式的字符串
    const langRegex = /(?<=<(span|translation)[^<>]+)xml:lang="([^"]+)"/g
    const matches = ttml_text.matchAll(langRegex)

    // 提取匹配结果并去重
    const langSet = new Set<string>()
    for (const match of matches) {
      if (match[2]) langSet.add(match[2])
    }

    return Array.from(langSet)
  }

  const lang_filter = (langs: string[]): string | null => {
    if (langs.length <= 1) return null

    const lang_matcher = (target: string) => {
      return langs.find((lang) => {
        try {
          // @ts-expect-error Intl.Locale type definition is missing maximize method
          return new Intl.Locale(lang).maximize().script === target
        } catch {
          return false
        }
      })
    }

    const hans_matched = lang_matcher('Hans')
    if (hans_matched) return hans_matched

    const hant_matched = lang_matcher('Hant')
    if (hant_matched) return hant_matched

    const major = langs.find((key) => key.startsWith('zh'))
    if (major) return major

    return langs[0]
  }

  const ttml_cleaner = (ttml_text: string, major_lang: string | null): string => {
    // 如果没有指定主语言，直接返回原文本（或者根据需求返回空）
    if (major_lang === null) return ttml_text

    /**
     * 替换逻辑回调函数
     * @param match 完整匹配到的标签字符串
     * @param lang 正则中第一个捕获组匹配到的语言代码
     */
    const replacer = (match: string, lang: string) => (lang === major_lang ? match : '')
    const translationRegex = /<translation[^>]+xml:lang="([^"]+)"[^>]*>[\s\S]*?<\/translation>/g
    const spanRegex = /<span[^>]+xml:lang="([^" ]+)"[^>]*>[\s\S]*?<\/span>/g
    return ttml_text.replace(translationRegex, replacer).replace(spanRegex, replacer)
  }

  const context_lang = lang_counter(ttmlContent)
  const major = lang_filter(context_lang)
  const cleaned_ttml = ttml_cleaner(ttmlContent, major)

  return cleaned_ttml.replace(/\n\s*/g, '')
}

/**
 * 简单的 TTML 解析器 (Wrapper for library)
 */
export const parseTTML = (content: string) => {
  return parseTTMLLib(content)
}
