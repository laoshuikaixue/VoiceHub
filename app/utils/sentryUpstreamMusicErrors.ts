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
  'TimeoutError',
  // 音源插件运行期失败：取不到播放地址、插件不可用、上游超时、媒体票据失效
  'PLUGIN_RESOLVE_FAILED',
  'PLUGIN_UNAVAILABLE',
  'PLUGIN_TIMEOUT',
  'PLUGIN_NETWORK_BLOCKED',
  'PLUGIN_INVALID_TICKET',
  // ofetch 错误消息自带请求路径，按路径过滤可与界面语言无关
  '/api/music-source-plugins/search',
  '/api/music-source-plugins/resolve',
  '/api/music-source-plugins/lyric'
]

// 插件音源运行期接口（搜索、解析、媒体流代理）
const PLUGIN_RUNTIME_PATH_PREFIX = '/api/music-source-plugins/'

// 上游断连、被中止等传输层失败：客户端切歌、插件源站点掐连接都会触发，非代码缺陷
const UPSTREAM_TRANSPORT_ERROR_PATTERNS = [
  'aborted',
  'socket hang up',
  'econnreset',
  'epipe',
  'premature close',
  'err_stream',
  'write after end'
]

type SentryLikeEvent = {
  message?: unknown
  request?: {
    url?: unknown
  }
  extra?: Record<string, unknown>
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
    // 机器可读错误码（Node 系统错误 code、客户端附加的 data.code 同族标记）
    record.code,
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
    // console 集成把原始参数放在 extra.arguments，只有这里能看到错误的 code 与 cause
    stringifyErrorValue(event.extra?.arguments),
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

const getRequestPath = (url: unknown): string => {
  if (typeof url !== 'string' || !url) return ''
  const withoutQuery = url.split('?')[0]
  try {
    return new URL(withoutQuery, 'http://voicehub.invalid').pathname
  } catch {
    return withoutQuery
  }
}

/** 插件音源接口上的上游断连/中止：属于插件源站点与播放器切换的正常波动，本地日志保留即可 */
export const isExpectedPluginRuntimeTransportError = (
  text: string,
  requestUrl: unknown
): boolean => {
  if (!getRequestPath(requestUrl).startsWith(PLUGIN_RUNTIME_PATH_PREFIX)) return false
  const normalizedText = text.toLowerCase()
  return UPSTREAM_TRANSPORT_ERROR_PATTERNS.some((pattern) => normalizedText.includes(pattern))
}
