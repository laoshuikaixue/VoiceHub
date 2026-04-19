import * as Sentry from '@sentry/vue'

let sentryClientInitialized = false

export default defineNuxtPlugin(async (nuxtApp) => {
  if (!import.meta.client || sentryClientInitialized) {
    return
  }

  const config = useRuntimeConfig()
  const sentryConfig = config.public?.sentry

  if (!sentryConfig?.enabled || !sentryConfig.dsn) {
    return
  }

  let instanceId = ''

  try {
    const response = await $fetch<{ success?: boolean; data?: { instanceId?: string } }>(
      '/api/system/instance'
    )
    instanceId = response?.data?.instanceId || ''
  } catch (error) {
    console.warn('[Sentry] Failed to resolve instance ID for client tagging:', error)
  }

  const deploymentTarget = config.public?.isNetlify
    ? 'netlify'
    : import.meta.env.VERCEL
      ? 'vercel'
      : 'self-hosted-node'

  const integrations = [Sentry.browserTracingIntegration({ router: nuxtApp.$router })]
  integrations.push(
    Sentry.consoleLoggingIntegration({
      levels: ['log', 'warn', 'error']
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
    enabled: sentryConfig.enabled,
    integrations,
    enableLogs: true,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
    replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate
  })

  sentryClientInitialized = true
  Sentry.setTag('runtime', 'vue')
  Sentry.setTag('deployment_target', deploymentTarget)
  if (instanceId) {
    Sentry.setTag('instance_id', instanceId)
    Sentry.setContext('instance', {
      instanceId
    })
  }

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

      Sentry.captureException(error)
    })
  })

  nuxtApp.hook('app:error', (error) => {
    if (instanceId) {
      Sentry.setTag('instance_id', instanceId)
    }
    Sentry.captureException(error)
  })
})
