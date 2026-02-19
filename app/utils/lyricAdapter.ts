/**
 * 歌词数据适配器
 * 将现有的歌词数据格式转换为 WordByWordLyrics 组件所需的 AMLL 格式
 */

import type { ParsedLyricLine as ExistingLyricLine } from '~/composables/useLyrics'

// AMLL 格式的接口定义
export interface LyricWord {
  startTime: number
  endTime: number
  word: string
  romanWord: string
  obscene: boolean
}

export interface AdapterLyricLine {
  words: LyricWord[]
  translatedLyric: string
  romanLyric: string
  startTime: number
  endTime: number
  isBG: boolean
  isDuet: boolean
}

/**
 * 将现有的歌词数据转换为 AMLL 格式
 * @param existingLyrics 现有的歌词数据
 * @param translationLyrics 翻译歌词数据
 * @param options 转换选项
 */
export function convertToAmllFormat(
  existingLyrics: ExistingLyricLine[],
  translationLyrics: ExistingLyricLine[] = [],
  options: {
    enableWordByWord?: boolean
    defaultDuration?: number
    romanization?: boolean
  } = {}
): AdapterLyricLine[] {
  const { enableWordByWord = true, defaultDuration = 1000, romanization = false } = options

  return existingLyrics.map((line, index) => {
    // 计算行的结束时间
    const nextLine = existingLyrics[index + 1]
    const endTime = nextLine ? nextLine.time : line.time + defaultDuration

    // 查找对应的翻译歌词
    const translation = findMatchingTranslation(line, translationLyrics)

    // 处理逐字歌词
    const words = processWords(line, endTime, enableWordByWord)

    return {
      words,
      translatedLyric:
        translation &&
        translation.content &&
        translation.content.trim() &&
        translation.content !== '//'
          ? translation.content
          : '',
      romanLyric: romanization ? generateRomanization(line.content) : '',
      startTime: line.time,
      endTime,
      isBG: false, // 可以根据需要扩展
      isDuet: false // 可以根据需要扩展
    }
  })
}

/**
 * 处理单行歌词的词汇数据
 */
function processWords(
  line: ExistingLyricLine,
  lineEndTime: number,
  enableWordByWord: boolean
): LyricWord[] {
  // 如果有逐字歌词数据，直接使用
  if (enableWordByWord && line.words && line.words.length > 0) {
    return line.words.map((word) => ({
      startTime: word.time,
      endTime: word.time + word.duration,
      word: word.content,
      romanWord: '',
      obscene: false
    }))
  }

  // 如果没有逐字歌词，将整行作为一个词处理
  if (line.content.trim()) {
    return [
      {
        startTime: line.time,
        endTime: lineEndTime,
        word: line.content,
        romanWord: '',
        obscene: false
      }
    ]
  }

  return []
}

/**
 * 查找匹配的翻译歌词
 */
function findMatchingTranslation(
  line: ExistingLyricLine,
  translations: ExistingLyricLine[]
): ExistingLyricLine | null {
  if (!translations.length) return null

  // 查找时间最接近的翻译
  let bestMatch: ExistingLyricLine | null = null
  let minTimeDiff = Infinity

  for (const translation of translations) {
    const timeDiff = Math.abs(translation.time - line.time)
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff
      bestMatch = translation
    }
  }

  // 如果时间差超过5秒，认为不匹配
  return minTimeDiff <= 5000 ? bestMatch : null
}

/**
 * 生成音译（简单实现，可以根据需要扩展）
 */
function generateRomanization(text: string): string {
  // 这里可以集成更复杂的音译逻辑
  // 目前返回空字符串，可以根据需要实现
  return ''
}

/**
 * 智能分词处理（用于没有逐字歌词的情况）
 */
export function smartWordSegmentation(
  text: string,
  startTime: number,
  endTime: number,
  options: {
    minWordDuration?: number
    maxWordDuration?: number
  } = {}
): LyricWord[] {
  const { minWordDuration = 200, maxWordDuration = 2000 } = options

  if (!text.trim()) return []

  // 分词逻辑：
  // 1. 对于英文，按空格分割单词
  // 2. 对于中文，只在句末标点符号处分割，避免拆分歌名中的数字和符号

  // 检测是否包含英文字母
  const hasEnglish = /[a-zA-Z]/.test(text)

  let segments: string[]

  if (hasEnglish) {
    // 英文内容：按空格和句末标点符号分割
    segments = text.split(/(\s+|[.!?。！？])/g).filter((s) => s.trim())
  } else {
    // 中文内容：只按句末标点符号分割，避免拆分歌名中的数字和符号
    segments = text.split(/([。！？])/g).filter((s) => s.trim() && !/^[。！？\s]+$/.test(s))
  }

  // 如果没有明显的分割点，或者分割后只有一个片段，将整行作为一个词处理
  if (segments.length <= 1) {
    return [
      {
        startTime,
        endTime,
        word: text.trim(),
        romanWord: '',
        obscene: false
      }
    ]
  }

  const totalDuration = endTime - startTime
  const avgDuration = Math.max(
    minWordDuration,
    Math.min(maxWordDuration, totalDuration / segments.length)
  )

  return segments.map((segment, index) => {
    const wordStartTime = startTime + index * avgDuration
    const wordEndTime = Math.min(wordStartTime + avgDuration, endTime)

    return {
      startTime: wordStartTime,
      endTime: wordEndTime,
      word: segment.trim(),
      romanWord: '',
      obscene: false
    }
  })
}

/**
 * 检测和标记背景歌词
 */
export function detectBackgroundLyrics(lyrics: AdapterLyricLine[]): AdapterLyricLine[] {
  return lyrics.map((line) => {
    // 简单的背景歌词检测逻辑
    const isBG =
      line.words.length === 0 ||
      line.words.every((word) => word.word.trim().length === 0) ||
      (line.translatedLyric.includes('(') && line.translatedLyric.includes(')'))

    return {
      ...line,
      isBG
    }
  })
}

/**
 * 检测和标记对唱歌词
 */
export function detectDuetLyrics(lyrics: AdapterLyricLine[]): AdapterLyricLine[] {
  return lyrics.map((line) => {
    // 简单的对唱检测逻辑
    const isDuet =
      line.translatedLyric.includes('(对唱)') ||
      line.translatedLyric.includes('(合唱)') ||
      line.words.some((word) => word.word.includes('(') && word.word.includes(')'))

    return {
      ...line,
      isDuet
    }
  })
}

/**
 * 完整的歌词数据转换流程
 */
export function fullLyricConversion(
  existingLyrics: ExistingLyricLine[],
  translationLyrics: ExistingLyricLine[] = [],
  options: {
    enableWordByWord?: boolean
    enableSmartSegmentation?: boolean
    enableBackgroundDetection?: boolean
    enableDuetDetection?: boolean
    romanization?: boolean
  } = {}
): AdapterLyricLine[] {
  const {
    enableWordByWord = true,
    enableSmartSegmentation = true,
    enableBackgroundDetection = true,
    enableDuetDetection = true,
    romanization = false
  } = options

  // 基础转换
  let convertedLyrics = convertToAmllFormat(existingLyrics, translationLyrics, {
    enableWordByWord,
    romanization
  })

  // 智能分词（对于没有逐字歌词的行）
  if (enableSmartSegmentation) {
    convertedLyrics = convertedLyrics.map((line) => {
      if (line.words.length === 1 && line.words[0].word === line.words[0].word.trim()) {
        const smartWords = smartWordSegmentation(line.words[0].word, line.startTime, line.endTime)

        if (smartWords.length > 1) {
          return {
            ...line,
            words: smartWords
          }
        }
      }
      return line
    })
  }

  // 背景歌词检测
  if (enableBackgroundDetection) {
    convertedLyrics = detectBackgroundLyrics(convertedLyrics)
  }

  // 对唱歌词检测
  if (enableDuetDetection) {
    convertedLyrics = detectDuetLyrics(convertedLyrics)
  }

  return convertedLyrics
}
