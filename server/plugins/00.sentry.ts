import * as Sentry from '@sentry/node'
import type { H3Event } from 'h3'
import { getInstanceIdInfo } from '../utils/instance-id'
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

const INSTANCE_ONLINE_TRANSACTION = 'voicehub.instance.online'

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

const captureInstanceOnlineTransaction = (instanceId: string, deploymentTarget: string) => {
  Sentry.startSpan({
    name: INSTANCE_ONLINE_TRANSACTION,
    op: 'app.startup',
    forceTransaction: true,
    parentSpan: null,
    attributes: {
      'voicehub.event_type': 'instance_online',
      'voicehub.instance_id': instanceId,
      'deployment.target': deploymentTarget,
      'runtime.name': 'nuxt',
      'nitro.preset': process.env.NITRO_PRESET || 'node-server'
    }
  }, () => {})
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const sentryConfig = config.sentry

  if (!sentryConfig?.enabled || !sentryConfig.dsn) {
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
      let instanceIdPersisted = false

      try {
        const instanceInfo = await getInstanceIdInfo()
        instanceId = instanceInfo.instanceId
        instanceIdPersisted = instanceInfo.persisted
      } catch (error) {
        console.warn('[Sentry] Failed to resolve instance ID for server tagging:', error)
      }

      const deploymentTarget = getDeploymentTarget()

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
        tracesSampler(samplingContext) {
          return samplingContext.name === INSTANCE_ONLINE_TRANSACTION
            ? 1
            : samplingContext.inheritOrSampleWith(sentryConfig.tracesSampleRate)
        },
        sendDefaultPii: false,
        beforeSend(event) {
          return isTelemetryEnabledCached() ? event : null
        },
        beforeSendTransaction(event) {
          return isTelemetryEnabledCached() ? event : null
        }
      })

      globalThis.__voicehubSentryServerInitialized = true

      Sentry.setTag('runtime', 'nuxt')
      Sentry.setTag('deployment_target', deploymentTarget)
      Sentry.setTag('nitro_preset', process.env.NITRO_PRESET || 'node-server')
      if (instanceId) {
        Sentry.setTag('instance_id', instanceId)
        Sentry.setTag('instance_id_persisted', String(instanceIdPersisted))
        Sentry.setContext('instance', {
          instanceId,
          persisted: instanceIdPersisted
        })
      }

      if (instanceIdPersisted && instanceId) {
        captureInstanceOnlineTransaction(instanceId, deploymentTarget)
      } else {
        console.warn('[Sentry] Skipped instance startup transaction because instance ID was not persisted.')
      }

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

  nitroApp.hooks.hook('close', async () => {
    if (globalThis.__voicehubSentryServerInitialized) {
      await Sentry.close(2000)
    }
  })

  void ensureSentryInitialized()
})
