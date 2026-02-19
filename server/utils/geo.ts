// 简单的地理位置检测工具
// 通过请求 ip-api.com 或其他公共 IP 服务来判断服务器位置

export interface GeoLocation {
  country: string
  countryCode: string
  region: string
  city: string
  isInChina: boolean
}

let cachedLocation: GeoLocation | null = null

export const getServerLocation = async (): Promise<GeoLocation> => {
  if (cachedLocation) {
    return cachedLocation
  }

  try {
    // 使用 ip-api.com (免费，限制 45 req/min)
    // 或者使用其他类似服务。这里为了稳定性，可以尝试多个源，或者只在启动时检测一次。
    // 注意：在某些服务器环境（如 Vercel Edge），可能需要特定的 Header 来获取 IP，但这里我们需要的是服务器本身的出口 IP 位置。

    // 尝试 ip-api.com
    const response: any = await $fetch(
      'http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city',
      {
        timeout: 5000
      }
    )

    if (response.status === 'success') {
      const isChina = response.countryCode === 'CN'
      cachedLocation = {
        country: response.country,
        countryCode: response.countryCode,
        region: response.regionName,
        city: response.city,
        isInChina: isChina
      }
      return cachedLocation
    }

    throw new Error('IP API failed')
  } catch (error) {
    console.warn(
      '[Geo] Failed to detect server location, defaulting to non-China (conservative strategy):',
      error
    )
    // 默认认为不在中国，使用保守策略（第三方 API 通常在全球可用性更好，或者说原生 API 在国外可能受限）
    // 或者根据用户需求，如果用户希望默认原生，可以改为 true。
    // 但通常原生 API (如网易/QQ) 在海外会有 IP 限制，所以默认 false 比较安全。
    return {
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      isInChina: false
    }
  }
}
