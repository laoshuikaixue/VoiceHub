import { getServerLocation } from '../../utils/geo'

export default defineEventHandler(async (event) => {
  // 缓存 1 小时，避免频繁请求外部 IP 服务
  setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=3600')

  const location = await getServerLocation()
  return {
    success: true,
    data: location
  }
})
