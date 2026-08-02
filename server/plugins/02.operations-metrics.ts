import { startOperationRequest, finishOperationRequest, recordBusinessOperation, recordOAuthOperation } from '~~/server/utils/operations-metrics'

const getPathname = (url = '') => url.split('?')[0]

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.node.req.url?.startsWith('/api/admin/operations/metrics')) return
    event.context.operationsMetricsStartedAt = startOperationRequest()
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const startedAt = event.context.operationsMetricsStartedAt
    if (typeof startedAt === 'number') {
      finishOperationRequest(startedAt, event.node.res.statusCode || 200)
      const path = getPathname(event.node.req.url)
      const success = (event.node.res.statusCode || 200) < 400
      if (path === '/api/songs/request' || path === '/api/open/songs/request') recordBusinessOperation('song_request', success)
      else if (path === '/api/songs/vote') recordBusinessOperation('vote', success)
      else if (path.startsWith('/api/admin/schedule')) recordBusinessOperation('schedule_save', success)
      if (/^\/api\/auth\/[^/]+\/(index|callback)$/.test(path)) recordOAuthOperation(success)
    }
  })
})
