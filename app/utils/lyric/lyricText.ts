import type { LyricLine, LyricWord } from '@applemusic-like-lyrics/lyric'

/** 歌词行文本提取的统一入口，避免各显示层内联重复实现 */

/** 单个单词的纯文本 */
export const getWordText = (word?: LyricWord | null): string => word?.word ?? ''

/** 歌词行的纯文本 */
export const getLineText = (line?: LyricLine | null): string => {
  if (!line?.words?.length) return ''
  return line.words.map(getWordText).join('')
}

/** 该行的逐字音译是否可用 */
export const hasWordRomanization = (line?: LyricLine | null): boolean =>
  Boolean(line?.words?.some((word) => Boolean(word.romanWord?.trim())))

/**
 * 该行的音译文本
 * 优先行级 romanLyric；没有则按逐字 romanWord 拼接
 */
export const getLineRomanization = (line?: LyricLine | null): string => {
  if (!line) return ''
  if (line.romanLyric) return line.romanLyric
  if (!line.words?.length) return ''
  return line.words.map((word) => word.romanWord ?? '').join('')
}

/** 该行是否存在可用于展示的音译（逐字或逐行任一） */
export const hasAnyRomanization = (line?: LyricLine | null): boolean =>
  Boolean(line?.romanLyric?.trim()) || hasWordRomanization(line)
