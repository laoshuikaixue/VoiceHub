const MAX_ERROR_CAUSE_DEPTH = 3

export const EXPECTED_UPSTREAM_MUSIC_ERROR_PATTERNS = [
  'QQ 音乐播放链接解析失败：',
  '返回已知无效音频链接',
  'music.3e0.cn 未返回播放重定向',
  'Huibq 返回',
  'Huibq 未返回播放链接',
  'qq-music-api 未返回歌词',
  '[tx.lyric] qq-music-api 歌词接口失败'
]

type SentryLikeEvent = {
  message?: unknown
  exception?: {
    values?: Array<{
      type?: unknown
      value?: unknown
    }>
  }
  logentry?: {
    message?: unknown
    params?: unknown
  }
}

type SentryLikeHint = {
  originalException?: unknown
  syntheticException?: unknown
}

export const stringifyErrorValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): string => {
  if (!value || depth > MAX_ERROR_CAUSE_DEPTH) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)

  if (seen.has(value)) return ''
  seen.add(value)

  const record = value as Record<string, unknown>
  const errorName = value instanceof Error ? value.name : record.name
  const errorMessage = value instanceof Error ? value.message : record.message

  return [
    errorName,
    errorMessage,
    record.statusMessage,
    record.statusCode,
    stringifyErrorValue(record.cause, depth + 1, seen)
  ]
    .filter((item) => item !== undefined && item !== null && item !== '')
    .map(String)
    .join(' ')
}

export const getSentryEventSearchText = (
  event: SentryLikeEvent,
  hint?: SentryLikeHint
): string => {
  const exceptionValues = event.exception?.values || []
  const exceptionTexts = exceptionValues.flatMap((value) => [
    value.type,
    value.value
  ])
  const logEntry = event.logentry || {}

  return [
    event.message,
    logEntry.message,
    ...(Array.isArray(logEntry.params) ? logEntry.params : []),
    ...exceptionTexts,
    stringifyErrorValue(hint?.originalException),
    stringifyErrorValue(hint?.syntheticException)
  ]
    .filter((item) => item !== undefined && item !== null && item !== '')
    .map(String)
    .join('\n')
}

export const isExpectedUpstreamMusicError = (text: string): boolean => {
  const normalizedText = text.toLowerCase()
  return EXPECTED_UPSTREAM_MUSIC_ERROR_PATTERNS.some((pattern) =>
    normalizedText.includes(pattern.toLowerCase())
  )
}
