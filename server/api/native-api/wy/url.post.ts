// ikun 网易云备用源服务端代理：上游 c.wwwweb.top 未开放浏览器跨域，取链请求须经后端转发
const IKUN_WY_URL = 'https://c.wwwweb.top/music/url'

// 网易云 level → 上游音质字符串；higher(192k) 上游无对应档，就近取 320k
const LEVEL_TO_QUALITY: Record<string, string> = {
  standard: '128k',
  higher: '320k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  jymaster: 'master',
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const musicId = String(body?.musicId ?? '').trim()
  if (!musicId) {
    throw createError({ statusCode: 400, message: '缺少歌曲ID' })
  }

  const quality = LEVEL_TO_QUALITY[String(body?.level || 'exhigh')] || '320k'

  const response = await fetch(IKUN_WY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'lx-music-desktop/2.10.1',
      'X-Api-Key': '',
    },
    body: JSON.stringify({ source: 'wy', musicId, quality }),
    signal: AbortSignal.timeout(10000),
  })
  const data: any = await response.json().catch(() => null)

  if (data?.code === 200 && typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
    return { success: true, url: data.url, quality: data.quality || quality }
  }

  throw createError({ statusCode: 502, message: data?.message || 'ikun 网易云未返回播放链接' })
})
