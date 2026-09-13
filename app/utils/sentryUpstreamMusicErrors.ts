const MAX_ERROR_CAUSE_DEPTH = 3

export const EXPECTED_UPSTREAM_MUSIC_ERROR_PATTERNS = [
  'QQ 音乐播放链接解析失败：',
  '返回已知无效音频链接',
  'qq-music-api 未返回歌词',
  '[tx.lyric] qq-music-api 歌词接口失败',
  // QQ 旧版歌词接口回退失败（业务码非 0 或 HTTP 非 2xx）
  'qq 歌词接口异常:',
  'qq 歌词接口返回',
  // B 站上游接口波动/风控（如 412 Precondition Failed），URL 由 ofetch 拼入错误消息
  'api.bilibili.com',
  'The operation was aborted due to timeout',
  'request timed out',
  'timeout exceeded',
  'TimeoutError'
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
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyErrorValue(item, depth + 1, seen))
      .filter(Boolean)
      .join(' ')
  }

  const record = value as Record<string, unknown>
  const errorName = value instanceof Error ? value.name : record.name
  const errorMessage = value instanceof Error ? value.message : record.message

  return [
    errorName,
    errorMessage,
    record.statusMessage,
    record.statusCode,
    // Sentry 日志参数（console.error 传入的错误对象）
    stringifyErrorValue(record.params, depth + 1, seen),
    // H3Error.data / FetchError.data
    stringifyErrorValue(record.data, depth + 1, seen),
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
