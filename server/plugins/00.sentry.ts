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

const buildRequestContext = (event: H3Event) => ({
  method: event.node.req.method || 'UNKNOWN',
  url: event.node.req.url || '',
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
        levels: ['log', 'warn', 'error']
      })
    ],
    enableLogs: true,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    sendDefaultPii: false
  })

  globalThis.__voicehubSentryServerInitialized = true

  Sentry.setTag('runtime', 'nuxt')
  Sentry.setTag('deployment_target', getDeploymentTarget())
  if (instanceId) {
    Sentry.setTag('instance_id', instanceId)
    Sentry.setContext('instance', {
      instanceId
    })
  }

  nitroApp.hooks.hook('error', (error, context) => {
    Sentry.withScope((scope) => {
      const event = context?.event
      if (event) {
        scope.setContext('request', buildRequestContext(event))
      }
      Sentry.captureException(error)
    })
  })

  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      Sentry.captureException(error)
    })

    process.on('uncaughtException', (error) => {
      Sentry.captureException(error)
    })
  }

  nitroApp.hooks.hook('close', async () => {
    await Sentry.close(2000)
  })
})
