import { getInstanceId } from '~~/server/utils/instance-id'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const instanceId = await getInstanceId()

  return {
    success: true,
    data: {
      instanceId
    }
  }
})
