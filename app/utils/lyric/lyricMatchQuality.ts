import { parseTTML, parseYrc } from '@applemusic-like-lyrics/lyric'
import { cleanTTMLTranslations, parseQRCLyric, parseSmartLrc } from './lyricParser'

const MIN_CONTENT_SCORE = 0.82
const MAX_ANCHOR_DIFF_MS = 3000
const MAX_P90_DIFF_MS = 2500
const MAX_TIMELINE_DRIFT_MS = 4000
const MIN_TIMELINE_RATIO = 0.985
const MAX_TIMELINE_RATIO = 1.015
const METADATA_LINE_RE =
  /^(?:作词|作曲|编曲|制作人|混音|母带|录音|词|曲|composer|lyricist|arranger|producer|mixed by)\s*[:：]/i

export type LyricMatchData = {
  lrc?: string
  yrc?: string
  ttml?: string
}

type ComparableLine = {
  text: string
  startTime: number
  endTime: number
}

type MatchAnchor = {
  referenceStart: number
  candidateStart: number
}

export type LyricMatchMetrics = {
  durationDiffMs?: number
  durationLimitMs?: number
  contentScore?: number
  anchorCount?: number
  timelineCoverage?: number
  withinTimeRatio?: number
  p90DiffMs?: number
  timelineDriftMs?: number
  timelineRatio?: number
}

export type LyricMatchDecision = {
  status: 'accepted' | 'rejected' | 'uncertain'
  reason: string
  metrics: LyricMatchMetrics
}

/** 归一化歌词正文，仅用于跨来源一致性比较 */
const normalizeText = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '')

/** 将不同解析器的行结构转为一致的比较结构 */
const toComparableLines = (lines: any[]): ComparableLine[] =>
  lines.flatMap((line) => {
    if (line?.isBG) return []
    const raw = Array.isArray(line?.words)
      ? line.words
          .map((word: any) => word?.word ?? word?.content ?? '')
          .join('')
          .trim()
      : String(line?.content ?? '').trim()
    if (!raw || METADATA_LINE_RE.test(raw)) return []
    const text = normalizeText(raw)
    if (text.length < 2) return []
    const startTime = Number(line?.startTime ?? line?.time ?? 0)
    const endTime = Number(line?.endTime ?? startTime)
    return [{ text, startTime, endTime }]
  })

/** 按格式优先级解析歌词正文 */
const parseComparableLyrics = (data: LyricMatchData): ComparableLine[] => {
  if (data.ttml?.trim()) {
    try {
      const parsed = parseTTML(cleanTTMLTranslations(data.ttml)) as any
      const lines = toComparableLines(parsed?.lines ?? [])
      if (lines.length > 0) return lines
    } catch {
      // 继续尝试逐字或普通歌词
    }
  }

  if (data.yrc?.trim()) {
    const raw = data.yrc.trim()
    try {
      if (raw.startsWith('<')) {
        const lines = toComparableLines(parseQRCLyric(raw))
        if (lines.length > 0) return lines
      } else {
        const lines = toComparableLines(parseYrc(raw) ?? [])
        if (lines.length > 0) return lines
      }
    } catch {
      // 继续回退到通用 LRC
    }
  }

  if (data.lrc?.trim()) {
    try {
      return toComparableLines(parseSmartLrc(data.lrc).lines)
    } catch {
      return []
    }
  }
  return []
}

/** 计算两个短文本的归一化编辑相似度 */
const textSimilarity = (left: string, right: string): number => {
  if (left === right) return 1
  if (!left || !right) return 0
  const previous = new Uint16Array(right.length + 1)
  const current = new Uint16Array(right.length + 1)
  for (let j = 0; j <= right.length; j++) previous[j] = j
  for (let i = 1; i <= left.length; i++) {
    current[0] = i
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      )
    }
    previous.set(current)
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length)
}

const joinSpan = (lines: ComparableLine[], start: number, count: number): string =>
  lines
    .slice(start, start + count)
    .map((line) => line.text)
    .join('')

/** 有序对齐歌词行，并允许相邻两行互相合并 */
const alignLines = (
  reference: ComparableLine[],
  candidate: ComparableLine[]
): { score: number; anchors: MatchAnchor[] } => {
  const width = candidate.length + 1
  const size = (reference.length + 1) * width
  const scores = new Float64Array(size)
  const prevReference = new Uint8Array(size)
  const prevCandidate = new Uint8Array(size)

  const update = (
    fromReference: number,
    fromCandidate: number,
    referenceCount: number,
    candidateCount: number,
    addedScore: number
  ) => {
    const nextReference = fromReference + referenceCount
    const nextCandidate = fromCandidate + candidateCount
    const from = fromReference * width + fromCandidate
    const next = nextReference * width + nextCandidate
    const score = scores[from] + addedScore
    if (score <= scores[next]) return
    scores[next] = score
    prevReference[next] = referenceCount
    prevCandidate[next] = candidateCount
  }

  for (let i = 0; i <= reference.length; i++) {
    for (let j = 0; j <= candidate.length; j++) {
      if (i < reference.length) update(i, j, 1, 0, 0)
      if (j < candidate.length) update(i, j, 0, 1, 0)
      for (let referenceCount = 1; referenceCount <= 2; referenceCount++) {
        if (i + referenceCount > reference.length) break
        for (let candidateCount = 1; candidateCount <= 2; candidateCount++) {
          if (j + candidateCount > candidate.length) break
          const referenceText = joinSpan(reference, i, referenceCount)
          const candidateText = joinSpan(candidate, j, candidateCount)
          const similarity = textSimilarity(referenceText, candidateText)
          if (similarity < 0.68) continue
          update(
            i,
            j,
            referenceCount,
            candidateCount,
            Math.min(referenceText.length, candidateText.length) * similarity
          )
        }
      }
    }
  }

  const anchors: MatchAnchor[] = []
  let i = reference.length
  let j = candidate.length
  while (i > 0 || j > 0) {
    const index = i * width + j
    const referenceCount = prevReference[index]
    const candidateCount = prevCandidate[index]
    if (referenceCount === 0 && candidateCount === 0) break
    const previousI = i - referenceCount
    const previousJ = j - candidateCount
    if (referenceCount > 0 && candidateCount > 0) {
      anchors.push({
        referenceStart: reference[previousI].startTime,
        candidateStart: candidate[previousJ].startTime
      })
    }
    i = previousI
    j = previousJ
  }
  anchors.reverse()
  return { score: scores[size - 1], anchors }
}

/** 检测高阶歌词是否与基准歌词属于同一录音版本 */
export const evaluateLyricDataMatch = (
  referenceData: LyricMatchData,
  candidateData: LyricMatchData,
  referenceDuration?: number,
  candidateDuration?: number
): LyricMatchDecision => {
  const metrics: LyricMatchMetrics = {}
  if (referenceDuration && candidateDuration) {
    metrics.durationDiffMs = Math.abs(referenceDuration - candidateDuration)
    metrics.durationLimitMs = Math.max(8000, referenceDuration * 0.04)
    if (metrics.durationDiffMs > metrics.durationLimitMs) {
      return { status: 'rejected', reason: 'duration_mismatch', metrics }
    }
  }

  const reference = parseComparableLyrics(referenceData)
  const candidate = parseComparableLyrics(candidateData)
  if (reference.length < 3 || candidate.length < 3) {
    return { status: 'uncertain', reason: 'insufficient_lines', metrics }
  }

  const aligned = alignLines(reference, candidate)
  const referenceChars = reference.reduce((sum, line) => sum + line.text.length, 0)
  const candidateChars = candidate.reduce((sum, line) => sum + line.text.length, 0)
  metrics.contentScore = (2 * aligned.score) / (referenceChars + candidateChars)
  if (metrics.contentScore < MIN_CONTENT_SCORE) {
    return { status: 'rejected', reason: 'content_mismatch', metrics }
  }

  const anchors = aligned.anchors.filter(
    (anchor) => Number.isFinite(anchor.referenceStart) && Number.isFinite(anchor.candidateStart)
  )
  metrics.anchorCount = anchors.length
  const lastReference = reference[reference.length - 1]
  const timelineDuration =
    referenceDuration || lastReference.endTime || lastReference.startTime || 0
  const minAnchors = timelineDuration > 0 && timelineDuration < 60000 ? 3 : 6
  if (anchors.length < minAnchors) {
    return { status: 'uncertain', reason: 'insufficient_anchors', metrics }
  }

  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  const referenceSpan = last.referenceStart - first.referenceStart
  const candidateSpan = last.candidateStart - first.candidateStart
  metrics.timelineCoverage = timelineDuration > 0 ? referenceSpan / timelineDuration : 0
  const minimumCoverage = timelineDuration > 0 && timelineDuration < 60000 ? 0.35 : 0.5
  if (metrics.timelineCoverage < minimumCoverage) {
    return { status: 'uncertain', reason: 'insufficient_timeline_coverage', metrics }
  }

  const differences = anchors
    .map((anchor) => Math.abs(anchor.candidateStart - anchor.referenceStart))
    .sort((left, right) => left - right)
  metrics.withinTimeRatio =
    differences.filter((difference) => difference <= MAX_ANCHOR_DIFF_MS).length / differences.length
  metrics.p90DiffMs = differences[Math.max(0, Math.ceil(differences.length * 0.9) - 1)]
  const firstOffset = first.candidateStart - first.referenceStart
  const lastOffset = last.candidateStart - last.referenceStart
  metrics.timelineDriftMs = Math.abs(lastOffset - firstOffset)
  metrics.timelineRatio = referenceSpan > 0 ? candidateSpan / referenceSpan : 0

  if (
    metrics.withinTimeRatio < 0.8 ||
    metrics.p90DiffMs > MAX_P90_DIFF_MS ||
    metrics.timelineDriftMs > MAX_TIMELINE_DRIFT_MS ||
    metrics.timelineRatio < MIN_TIMELINE_RATIO ||
    metrics.timelineRatio > MAX_TIMELINE_RATIO
  ) {
    return { status: 'rejected', reason: 'timeline_mismatch', metrics }
  }

  return { status: 'accepted', reason: 'matched', metrics }
}
