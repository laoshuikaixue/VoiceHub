import * as Sentry from '@sentry/node'
import type { H3Event } from 'h3'
import { getInstanceId } from '../utils/instance-id'
import { isTelemetryEnabled, isTelemetryEnabledCached } from '../utils/telemetry'

declare global {
  var __voicehubSentryServerInitialized: boolean | undefined
  var __voicehubSentryServerInitializing: Promise<boolean> | undefined
}

const getDeploymentTarget = (): string => {
  if (process.env.NETLIFY === 'true') return 'netlify'
  if (process.env.VERCEL) return 'vercel'
  if (process.env.NITRO_PRESET?.includes('cloudflare')) return 'cloudflare'
  return 'self-hosted-node'
}

const shouldCaptureServerError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return true
  const maybeStatusCode = (error as { statusCode?: unknown }).statusCode
  const statusCode = typeof maybeStatusCode === 'number' ? maybeStatusCode : undefined

  // Drop expected business/auth errors (4xx) to avoid Sentry noise.
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return false
  }

  return true
}

const buildRequestContext = (event: H3Event) => {
  const rawUrl = event.node.req.url || ''
  // 移除 querystring，避免把敏感信息（如 token）泄露到 Sentry
  const pathname = rawUrl.split('?')[0] || rawUrl

  return {
    method: event.node.req.method || 'UNKNOWN',
    url: pathname,
    requestId: event.context.requestId || '',
    headers: {
      host: event.node.req.headers.host || '',
      userAgent: event.node.req.headers['user-agent'] || ''
    }
  }
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const sentryConfig = config.sentry

  if (!sentryConfig?.dsn) {
    return
  }

  const ensureSentryInitialized = async (): Promise<boolean> => {
    if (globalThis.__voicehubSentryServerInitialized) {
      return true
    }

    if (globalThis.__voicehubSentryServerInitializing) {
      return globalThis.__voicehubSentryServerInitializing
    }

    globalThis.__voicehubSentryServerInitializing = (async () => {
      const telemetryEnabled = await isTelemetryEnabled()
      if (!telemetryEnabled) {
        return false
      }

      let instanceId = ''

      try {
        instanceId = await getInstanceId()
      } catch (error) {
        console.warn('[Sentry] Failed to resolve instance ID for server tagging:', error)
      }

      Sentry.init({
        dsn: sentryConfig.dsn,
        environment: sentryConfig.environment,
        release: sentryConfig.release || undefined,
        integrations: [
          Sentry.consoleLoggingIntegration({
            levels: process.env.NODE_ENV === 'development' ? ['log', 'warn', 'error'] : ['error']
          })
        ],
        enableLogs: true,
        tracesSampleRate: sentryConfig.tracesSampleRate,
        sendDefaultPii: false,
        beforeSend(event) {
          return isTelemetryEnabledCached() ? event : null
        }
      })

      globalThis.__voicehubSentryServerInitialized = true

      Sentry.setTag('runtime', 'nuxt')
      Sentry.setTag('deployment_target', getDeploymentTarget())
      Sentry.setTag('nitro_preset', process.env.NITRO_PRESET || 'node-server')
      if (instanceId) {
        Sentry.setTag('instance_id', instanceId)
        Sentry.setContext('instance', {
          instanceId
        })
      }

      Sentry.withScope((scope) => {
        scope.setLevel('info')
        scope.setFingerprint(['instance_heartbeat', instanceId])
        scope.setTag('event_type', 'heartbeat')
        Sentry.captureMessage('instance_online')
      })

      return true
    })().finally(() => {
      globalThis.__voicehubSentryServerInitializing = undefined
    })

    return globalThis.__voicehubSentryServerInitializing
  }

  nitroApp.hooks.hook('error', async (error, context) => {
    if (!shouldCaptureServerError(error)) {
      return
    }

    const initialized = await ensureSentryInitialized()
    if (!initialized) {
      return
    }

    Sentry.withScope((scope) => {
      const event = context?.event
      if (event) {
        scope.setContext('request', buildRequestContext(event))
        if (event.context.requestId) {
          scope.setTag('request_id', event.context.requestId)
        }
      }

      scope.setLevel('error')
      Sentry.captureException(error)
    })
  })

  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('unhandledRejection', (reason) => {
      void (async () => {
        const initialized = await ensureSentryInitialized()
        if (!initialized) return

        const error = reason instanceof Error ? reason : new Error(String(reason))
        Sentry.withScope((scope) => {
          scope.setLevel('error')
          Sentry.captureException(error)
        })
      })()
    })

    process.on('uncaughtException', (error) => {
      void (async () => {
        const initialized = await ensureSentryInitialized()
        if (!initialized) return

        Sentry.withScope((scope) => {
          scope.setLevel('fatal')
          Sentry.captureException(error)
        })
      })()
    })
  }

  nitroApp.hooks.hook('close', async () => {
    if (globalThis.__voicehubSentryServerInitialized) {
      await Sentry.close(2000)
    }
  })

  ensureSentryInitialized()
})
