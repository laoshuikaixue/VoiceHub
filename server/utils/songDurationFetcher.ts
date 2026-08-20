import {
  createTxSongDetailBody,
  normalizeTxMusicId,
  txHeaders
} from '~~/server/utils/native_tx'

/**
 * 按平台获取歌曲时长（秒）
 * 返回 null 表示获取失败
 */
export async function fetchSongDuration(platform: string, musicId: string): Promise<number | null> {
  if (!platform || !musicId) return null

  try {
    if (platform === 'netease' || platform === 'netease-podcast') {
      const response: any = await $fetch('/api/api-enhanced/netease/song/url/v1', {
        params: { id: musicId, level: 'standard' },
        timeout: 10000
      })
      const timeMs = response?.data?.[0]?.time
      if (typeof timeMs === 'number' && timeMs > 0) {
        const seconds = Math.floor(timeMs / 1000)
        // 网易云固定返回 30 秒时通常是试听片段，不作为歌曲完整时长。
        if (seconds >= 30 && seconds <= 3600 && seconds !== 30) return seconds
      }
      return null
    }

    if (platform === 'tencent') {
      const normalized = normalizeTxMusicId(musicId)
      const result: any = await $fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        method: 'POST',
        headers: txHeaders,
        body: createTxSongDetailBody(normalized),
        responseType: 'json',
        timeout: 10000
      })
      const interval = result?.req?.data?.track_info?.interval
      if (typeof interval === 'number' && interval > 0) {
        const seconds = Math.floor(interval)
        if (seconds >= 30 && seconds <= 3600) return seconds
      }
      return null
    }

    if (platform === 'migu') {
      const info: any = await $fetch(
        `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${encodeURIComponent(musicId)}`,
        { timeout: 10000 }
      )
      const duration = info?.data?.[0]?.duration
      if (typeof duration === 'number' && duration > 0) {
        const seconds = Math.floor(duration)
        if (seconds >= 30 && seconds <= 3600) return seconds
      }
      return null
    }

    if (platform === 'bilibili') {
      const parts = String(musicId).split(':')
      const bvid = parts[0]
      const page = parts.length > 2 ? Number(parts[2]) : 1
      if (parts.length > 2 && (!Number.isInteger(page) || page < 1)) return null
      const viewResp: any = await $fetch('https://api.bilibili.com/x/web-interface/view', {
        params: { bvid },
        headers: { Cookie: 'buvid3=0', Referer: 'https://www.bilibili.com/' },
        timeout: 10000
      })
      const pageIdx = page > 1 ? Math.max(0, page - 1) : 0
      const duration = viewResp?.data?.pages?.[pageIdx]?.duration
      if (typeof duration === 'number' && duration > 0) {
        const seconds = Math.floor(duration)
        if (seconds >= 30 && seconds <= 3600) return seconds
      }
      return null
    }
  } catch {
    // 外部接口失败时静默降级
  }
  return null
}
