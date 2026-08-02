import { startOperationRequest, finishOperationRequest } from '~~/server/utils/operations-metrics'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.node.req.url?.startsWith('/api/admin/operations/metrics')) return
    event.context.operationsMetricsStartedAt = startOperationRequest()
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const startedAt = event.context.operationsMetricsStartedAt
    if (typeof startedAt === 'number') {
      finishOperationRequest(startedAt, event.node.res.statusCode || 200)
    }
  })
})
