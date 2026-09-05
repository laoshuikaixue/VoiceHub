import type { LyricLine } from '@applemusic-like-lyrics/lyric'

// 时间戳支持 [m:ss] / [mm:ss] / [m:ss.f] / [mm:ss.fff]，分钟 1-2 位、毫秒位 1-3 位按十进制补齐 3 位
const LRC_LINE_TIME_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
const META_TAG_REGEX = /^\[[a-z]+:/i

/** 毫秒位固定宽度（十进制小数补齐到毫秒） */
const MS_DIGITS = 3
/** 最后一行无后续行时的兜底展示时长 */
const LAST_LINE_DURATION_MS = 5000

/**
 * 解析时间标签为毫秒，毫秒位按十进制小数补齐（.7 -> 700ms）
 */
export const parseTimeToMs = (min: string, sec: string, ms?: string): number => {
  const msNormalized = (ms ?? '0').padEnd(MS_DIGITS, '0').slice(0, MS_DIGITS)
  return parseInt(min, 10) * 60 * 1000 + parseInt(sec, 10) * 1000 + parseInt(msNormalized, 10)
}

export const parseLrc = (lrcContent: string): LyricLine[] => {
  if (!lrcContent) return []

  const lines = lrcContent.split(/\r?\n/)
  const result: LyricLine[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    // 跳过元数据
    if (META_TAG_REGEX.test(trimmedLine)) continue

    const matches = [...trimmedLine.matchAll(LRC_LINE_TIME_TAG_REGEX)]
    // 不含合法时间戳的行视为非歌词行（元数据、杂项），静默跳过
    if (matches.length === 0) continue

    // 提取歌词文本（移除所有时间标签）
    const text = trimmedLine.replace(LRC_LINE_TIME_TAG_REGEX, '').trim()
    // 纯时间戳行（间奏标记）不产出歌词行
    if (!text) continue

    // 处理一行多个时间标签的情况（重复歌词）
    for (const match of matches) {
      const startTime = parseTimeToMs(match[1], match[2], match[3])

      result.push({
        startTime,
        endTime: 0, // 稍后计算
        words: [{ word: text, startTime, endTime: 0, romanWord: '' }],
        translatedLyric: '',
        romanLyric: '',
        isBG: false,
        isDuet: false
      })
    }
  }

  // 按时间排序
  result.sort((a, b) => a.startTime - b.startTime)

  // 计算结束时间
  for (let i = 0; i < result.length; i++) {
    const line = result[i]
    const nextLine = result[i + 1]

    if (nextLine) {
      line.endTime = nextLine.startTime
    } else {
      line.endTime = line.startTime + LAST_LINE_DURATION_MS
    }

    // 更新单词结束时间
    if (line.words.length > 0) {
      line.words[0].endTime = line.endTime
    }
  }

  return result
}
