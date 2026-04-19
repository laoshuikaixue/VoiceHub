import * as Sentry from '@sentry/vue'

let sentryClientInitialized = false
let instanceId = ''

const shouldDropClientEvent = (event: Sentry.ErrorEvent, hint?: Sentry.EventHint): boolean => {
  const originalException = hint?.originalException
  if (originalException instanceof DOMException && originalException.name === 'AbortError') {
    return true
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
  if (!import.meta.client || sentryClientInitialized) {
    return
  }

  const config = useRuntimeConfig()
  const sentryConfig = config.public?.sentry

  if (!sentryConfig?.enabled || !sentryConfig.dsn) {
    return
  }

  const deploymentTarget = config.public?.isNetlify
    ? 'netlify'
    : import.meta.env.VERCEL
      ? 'vercel'
      : 'self-hosted-node'

  const integrations = [Sentry.browserTracingIntegration({ router: nuxtApp.$router })]
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

  // Initialize Sentry immediately without blocking - don't wait for instance ID
  Sentry.init({
    app: nuxtApp.vueApp,
    dsn: sentryConfig.dsn,
    environment: sentryConfig.environment,
    release: sentryConfig.release || undefined,
    enabled: sentryConfig.enabled,
    integrations,
    enableLogs: true,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
    replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate,
    beforeSend(event, hint) {
      if (shouldDropClientEvent(event, hint)) {
        return null
      }

      event.level = 'error'
      return event
    }
  })

  sentryClientInitialized = true
  Sentry.setTag('runtime', 'vue')
  Sentry.setTag('deployment_target', deploymentTarget)

  // Fetch instance ID in the background after app has mounted
  nuxtApp.hook('app:mounted', async () => {
    try {
      const response = await $fetch<{ success?: boolean; data?: { instanceId?: string } }>(
        '/api/system/instance'
      )
      const fetchedInstanceId = response?.data?.instanceId
      if (fetchedInstanceId) {
        instanceId = fetchedInstanceId
        Sentry.setTag('instance_id', instanceId)
        Sentry.setContext('instance', {
          instanceId
        })
      }
    } catch (error) {
      console.warn('[Sentry] Failed to resolve instance ID for client tagging:', error)
    }
  })

  nuxtApp.hook('vue:error', (error, instance, info) => {
    Sentry.withScope((scope) => {
      scope.setContext('vue', { info })
      if (instanceId) {
        scope.setTag('instance_id', instanceId)
      }

      const componentName = instance?.$?.type?.name
      if (componentName) {
        scope.setTag('vue_component', componentName)
      }

      scope.setLevel('error')
      Sentry.captureException(error)
    })
  })

  nuxtApp.hook('app:error', (error) => {
    Sentry.withScope((scope) => {
      if (instanceId) {
        scope.setTag('instance_id', instanceId)
      }
      scope.setLevel('error')
      Sentry.captureException(error)
    })
  })
})
