import * as Sentry from '@sentry/vue'
import type { Event, EventHint } from '@sentry/vue'
import {
  getSentryEventSearchText,
  isExpectedUpstreamMusicError
} from '~/utils/sentryUpstreamMusicErrors'

let sentryClientInitialized = false
let sentryClientInitializing = false
let instanceId = ''
const TELEMETRY_STORAGE_KEY = 'voicehub.telemetryEnabled'

const isTelemetryDisabledLocally = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' &&
      localStorage.getItem(TELEMETRY_STORAGE_KEY) === 'false'
  } catch {
    return false
  }
}

const setTelemetryStorageValue = (value: string) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TELEMETRY_STORAGE_KEY, value)
    }
  } catch {
    // 隐私模式可能禁用 localStorage，遥测开关以服务端返回为准。
  }
}

const shouldDropClientEvent = (event: Event, hint?: EventHint): boolean => {
  if (isTelemetryDisabledLocally()) {
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
        setTelemetryStorageValue('false')
        return
      }

      setTelemetryStorageValue('true')
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
      setTelemetryStorageValue('false')
      console.warn('[Sentry] Failed to initialize client telemetry:', error)
    } finally {
      sentryClientInitializing = false
    }
  })()
})
