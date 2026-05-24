import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  const incomingRequestId = getHeader(event, 'x-request-id')
  const requestId = incomingRequestId && incomingRequestId.trim().length > 0
    ? incomingRequestId.trim()
    : randomUUID()

  event.context.requestId = requestId
  setHeader(event, 'x-request-id', requestId)
})
