import type { NeteaseCloudFile } from './neteaseCloud'

export const catalogQualityError = () => Object.assign(new Error('公开曲库未提供所选音质'), {
  data: { code: 'MUSIC_CATALOG_QUALITY_UNAVAILABLE' }
})

const isCloudFile = (track: any, files: NeteaseCloudFile[]) => files.some(file => {
  if (file.md5 && track.md5) return file.md5.toLowerCase() === String(track.md5).toLowerCase()
  return file.fileSize > 0 && file.fileSize === Number(track.size) &&
    file.format.toUpperCase() === String(track.type || '').toUpperCase()
})

/** 登录态取链可能被个人云盘覆盖；重试公开会话时仍须核对所选音质。 */
export async function resolveNeteaseCatalogUrl(options: {
  fetcher: (url: string, options: any) => Promise<any>
  baseUrl: string
  id: string | number
  level: string
  cookie?: string
  cloudFiles?: NeteaseCloudFile[]
  signal?: AbortSignal
  timeout?: number
}) {
  const { fetcher, baseUrl, id, level, cookie, cloudFiles = [], signal, timeout = 8000 } = options
  for (const session of cookie ? [cookie, ''] : ['']) {
    signal?.throwIfAborted()
    try {
      const response = await fetcher(`${baseUrl}/song/url/v1`, {
        // SDK 会在 cookie 缺省时读取服务端 NETEASE_COOKIE，空登录字段用于明确请求匿名会话。
        params: { id, level, unblock: false, cookie: session || 'MUSIC_U=;' },
        signal, timeout
      })
      const track = response?.data?.[0]
      if (response?.code === 200 && /^https?:\/\//i.test(track?.url || '') &&
          String(track.id ?? id) === String(id) &&
          track.level === level && !track.freeTrialInfo &&
          (!session || !isCloudFile(track, cloudFiles))) {
        return { url: String(track.url).replace(/^http:\/\//, 'https://'), actualQuality: track.level }
      }
    } catch (error) {
      signal?.throwIfAborted()
      if ((error as Error)?.name === 'AbortError') throw error
    }
  }
  throw catalogQualityError()
}
