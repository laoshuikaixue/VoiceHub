import { TRAD_TO_SIMP } from './data/cjkT2sMap.ts'

/** 由映射表键构建繁体字符类（u 标志保证扩展区码点按整字匹配） */
const TRAD_CHARS = Object.keys(TRAD_TO_SIMP)
  .map((ch) => (ch === '\\' || ch === ']' || ch === '-' ? `\\${ch}` : ch))
  .join('')
const TRAD_RE = new RegExp(`[${TRAD_CHARS}]`, 'gu')

/** 繁体转简体（仅单字映射，用于匹配归一化，不做词汇级转换） */
export function toSimplifiedChinese(str: string): string {
  if (!str) return str
  return str.replace(TRAD_RE, (ch) => TRAD_TO_SIMP[ch] ?? ch)
}

/**
 * 歌曲名/歌手名匹配归一化（前后端唯一权威实现）
 * 口径：繁→简 → 小写 → 移除 feat./ft. → &/＆ → and → 移除空白与全半角标点
 */
export function normalizeForMatch(str: string): string {
  return toSimplifiedChinese(String(str ?? ''))
    .toLowerCase()
    .replace(/\b(feat\.?|ft\.?)\b/gi, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[\s\-_\(\)\[\]【】（）「」『』《》〈〉"'“”‘’、，。！？：；～·]/g, '')
    .trim()
}
