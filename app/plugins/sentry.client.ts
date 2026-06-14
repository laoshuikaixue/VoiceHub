import * as Sentry from '@sentry/vue'
import type { Event, EventHint } from '@sentry/vue'

let sentryClientInitialized = false
let sentryClientInitializing = false
let instanceId = ''
const TELEMETRY_STORAGE_KEY = 'voicehub.telemetryEnabled'
const EXPECTED_UPSTREAM_MUSIC_ERROR_PATTERNS = [
  'QQ 音乐播放链接解析失败：',
  '返回已知无效音频链接',
  'music.3e0.cn 未返回播放重定向',
  'Huibq 返回',
  'Huibq 未返回播放链接',
  'qq-music-api 未返回歌词',
  '[tx.lyric] qq-music-api 歌词接口失败'
]

const stringifyErrorValue = (value: unknown): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  return [
    record.message,
    record.statusMessage,
    record.statusCode,
    stringifyErrorValue(record.cause)
  ]
    .filter((item) => item !== undefined && item !== null && item !== '')
    .map(String)
    .join(' ')
}

const getSentryEventSearchText = (event: Event, hint?: EventHint): string => {
  const exceptionTexts = event.exception?.values?.flatMap(value => [
    value.type,
    value.value
  ]) || []

  return [
    event.message,
    ...exceptionTexts,
    stringifyErrorValue(hint?.originalException),
    stringifyErrorValue(hint?.syntheticException)
  ]
    .filter((item) => item !== undefined && item !== null && item !== '')
    .map(String)
    .join('\n')
}

const isExpectedUpstreamMusicError = (text: string): boolean => {
  const normalizedText = text.toLowerCase()
  return EXPECTED_UPSTREAM_MUSIC_ERROR_PATTERNS.some((pattern) =>
    normalizedText.includes(pattern.toLowerCase())
  )
}

const shouldDropClientEvent = (event: Event, hint?: EventHint): boolean => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(TELEMETRY_STORAGE_KEY) === 'false') {
    return true
  }

  const originalException = hint?.originalException
  if (originalException instanceof DOMException && originalException.name === 'AbortError') {
    return true
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true
  }

  // 外部音源接口波动属于预期失败，本地交互提示即可。
  if (isExpectedUpstreamMusicError(getSentryEventSearchText(event, hint))) {
    return true
  }

  const message = (event.message || '').toLowerCase()
  if (message.includes('aborterror') || message.includes('networkerror')) {
    return true
  }

  const frames = event.exception?.values?.flatMap(value => value.stacktrace?.frames || []) || []
  if (frames.some(frame => {
    const filename = frame.filename || ''
    return filename.startsWith('chrome-extension://') || filename.startsWith('moz-extension://')
  })) {
    return true
  }

  return false
}

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client || sentryClientInitialized || sentryClientInitializing) {
    return
  }

  const config = useRuntimeConfig()
  const sentryConfig = config.public?.sentry

  if (!sentryConfig?.enabled || !sentryConfig.dsn) {
    return
  }

  sentryClientInitializing = true

  void (async () => {
    try {
      const response = await $fetch<{
        success?: boolean
        data?: { instanceId?: string; telemetryEnabled?: boolean }
      }>('/api/system/instance')

      if (!response?.data?.telemetryEnabled) {
        localStorage.setItem(TELEMETRY_STORAGE_KEY, 'false')
        return
      }

      localStorage.setItem(TELEMETRY_STORAGE_KEY, 'true')
      instanceId = response.data.instanceId || ''
      console.log(`[VoiceHub] 遥测已开启，实例 ID: ${instanceId}（提交 Bug 时可提供此 ID 以便开发者定位）`)

      const deploymentTarget = config.public?.isNetlify
        ? 'netlify'
        : import.meta.env.VERCEL
          ? 'vercel'
          : 'self-hosted-node'

      const sentryRouter = nuxtApp.$router as NonNullable<
        Parameters<typeof Sentry.browserTracingIntegration>[0]
      >['router']
      const integrations = [Sentry.browserTracingIntegration({ router: sentryRouter })]
      integrations.push(
        Sentry.consoleLoggingIntegration({
          levels: import.meta.dev ? ['log', 'warn', 'error'] : ['error']
        })
      )
      if (
        sentryConfig.replaysSessionSampleRate > 0 ||
        sentryConfig.replaysOnErrorSampleRate > 0
      ) {
        integrations.push(Sentry.replayIntegration())
      }

      Sentry.init({
        app: nuxtApp.vueApp,
        dsn: sentryConfig.dsn,
        environment: sentryConfig.environment,
        release: sentryConfig.release || undefined,
        integrations,
        enableLogs: true,
        tracesSampleRate: sentryConfig.tracesSampleRate,
        replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
        replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate,
        beforeSend(event, hint) {
          if (shouldDropClientEvent(event, hint)) {
            return null
          }

          return event
        }
      })

      sentryClientInitialized = true

      Sentry.setTag('runtime', 'vue')
      Sentry.setTag('deployment_target', deploymentTarget)
      if (instanceId) {
        Sentry.setTag('instance_id', instanceId)
        Sentry.setContext('instance', { instanceId })
      }
    } catch (error) {
      localStorage.setItem(TELEMETRY_STORAGE_KEY, 'false')
      console.warn('[Sentry] Failed to initialize client telemetry:', error)
    } finally {
      sentryClientInitializing = false
    }
  })()
})
