import * as Sentry from '@sentry/node'
import type { H3Event } from 'h3'
import { getInstanceId } from '../utils/instance-id'

declare global {
  var __voicehubSentryServerInitialized: boolean | undefined
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

const buildRequestContext = (event: H3Event) => ({
  method: event.node.req.method || 'UNKNOWN',
  url: event.node.req.url || '',
  requestId: event.context.requestId || '',
  headers: {
    host: event.node.req.headers.host || '',
    userAgent: event.node.req.headers['user-agent'] || ''
  }
})

export default defineNitroPlugin(async (nitroApp) => {
  if (globalThis.__voicehubSentryServerInitialized) {
    return
  }

  const config = useRuntimeConfig()
  const sentryConfig = config.sentry

  if (!sentryConfig?.enabled || !sentryConfig.dsn) {
    return
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
    enabled: sentryConfig.enabled,
    integrations: [
      Sentry.consoleLoggingIntegration({
        levels: process.env.NODE_ENV === 'development' ? ['log', 'warn', 'error'] : ['error']
      })
    ],
    enableLogs: true,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    sendDefaultPii: false
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

  nitroApp.hooks.hook('error', (error, context) => {
    if (!shouldCaptureServerError(error)) {
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
      const error = reason instanceof Error ? reason : new Error(String(reason))
      Sentry.withScope((scope) => {
        scope.setLevel('error')
        Sentry.captureException(error)
      })
    })

    process.on('uncaughtException', (error) => {
      Sentry.withScope((scope) => {
        scope.setLevel('fatal')
        Sentry.captureException(error)
      })
    })
  }

  nitroApp.hooks.hook('close', async () => {
    await Sentry.close(2000)
  })
})
