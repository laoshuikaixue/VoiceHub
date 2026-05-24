import { getInstanceId } from '~~/server/utils/instance-id'
import { isTelemetryEnabled } from '~~/server/utils/telemetry'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')

  const instanceId = await getInstanceId()
  const telemetryEnabled = await isTelemetryEnabled()

  return {
    success: true,
    data: {
      instanceId,
      telemetryEnabled
    }
  }
})
