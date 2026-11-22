import { getUpdateStatus } from '~~/server/utils/web-update'

export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return getUpdateStatus(event)
})
