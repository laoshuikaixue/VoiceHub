import type { LyricLine } from '@applemusic-like-lyrics/lyric'

/** 日语假名：平假名 + 片假名 + 半角假名 + 促音/长音符号 */
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}\u30FC\uFF66-\uFF9F]/u

/** 韩文：谚文音节 + 谚文字母 + 谚文兼容字母 */
const HANGUL_RE = /[\p{Script=Hangul}\u3130-\u318F]/u

/** 中日韩统一表意文字（含扩展区） */
const HAN_RE = /\p{Script=Han}/u

/** 拉丁字母；数字与标点不能作为英文判断依据 */
const LATIN_RE = /\p{Script=Latin}/u

type LanguageSourceLine = Pick<LyricLine, 'words'> & Partial<Pick<LyricLine, 'translatedLyric'>>

/** 判断是否有实质内容的翻译歌词 */
const hasTranslation = (line: LanguageSourceLine): boolean =>
  (line.translatedLyric ?? '').trim().length > 0

/**
 * 基于整首歌词上下文推断每行语言，返回与行数组对齐的 BCP 47 语言标签数组
 *
 * Han 脚本无法独立区分中日韩；
 * - 同一首歌词出现假名时，通常将纯汉字行视为日语；
 * - 同一首歌词出现谚文时，通常将纯汉字行视为韩语；
 * - CJK 混合启发式规则：若所有包含假名/谚文的行均有翻译，
 *   则认定全为汉字且无翻译的行为中文，以此区分双语混合歌词；
 * - 拉丁文字使用 BCP 47 的 und-Latn，避免误标为英语；
 * - 无法判断时返回 undefined（不设置 lang 属性）。
 *
 * @param lines 已解析的整首歌词
 */
export const detectLyricLanguages = (
  lines: ReadonlyArray<LanguageSourceLine>
): Array<string | undefined> => {
  const lineContents = lines.map((line) => line.words.map((word) => word.word).join(''))

  let hasKana = false
  let hasHangul = false
  let kanaUntranslatedCount = 0
  let hangulUntranslatedCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const content = lineContents[i] ?? ''
    const isTranslated = line ? hasTranslation(line) : false

    if (KANA_RE.test(content)) {
      hasKana = true
      if (!isTranslated) kanaUntranslatedCount++
    }
    if (HANGUL_RE.test(content)) {
      hasHangul = true
      if (!isTranslated) hangulUntranslatedCount++
    }
  }

  const allKanaTranslated = hasKana && kanaUntranslatedCount === 0
  const allHangulTranslated = hasHangul && hangulUntranslatedCount === 0

  return lines.map((line, i) => {
    const content = lineContents[i] ?? ''
    const isTranslated = hasTranslation(line)

    if (KANA_RE.test(content)) return 'ja'
    if (HANGUL_RE.test(content)) return 'ko'
    if (HAN_RE.test(content)) {
      if (hasKana) return allKanaTranslated && !isTranslated ? 'zh-CN' : 'ja'
      if (hasHangul) return allHangulTranslated && !isTranslated ? 'zh-CN' : 'ko'
      return 'zh-CN'
    }
    if (LATIN_RE.test(content)) return 'und-Latn'
    return undefined
  })
}
