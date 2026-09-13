import {
  createTxSongDetailBody,
  normalizeTxMusicId,
  txHeaders
} from '~~/server/utils/native_tx'

// 网易云 pic 字段可能是 http，统一升级 https
const upgradeHttps = (url: string) => (url.startsWith('http://') ? url.replace('http://', 'https://') : url)

/**
 * 按平台获取歌曲封面 URL
 * 返回 null 表示获取失败
 */
export async function fetchSongCover(platform: string, musicId: string): Promise<string | null> {
  if (!platform || !musicId) return null

  try {
    if (platform === 'netease' || platform === 'netease-podcast') {
      const response: any = await $fetch('/api/api-enhanced/netease/song/url/v1', {
        params: { id: musicId, level: 'standard' },
        timeout: 10000
      })
      const pic = response?.data?.[0]?.pic
      if (typeof pic === 'string' && pic) return upgradeHttps(pic)

      // url/v1 无封面时回退歌曲详情接口
      const detail: any = await $fetch('/api/api-enhanced/netease/song/detail', {
        params: { ids: String(musicId) },
        timeout: 10000
      })
      const picUrl = detail?.songs?.[0]?.al?.picUrl
      if (typeof picUrl === 'string' && picUrl) return upgradeHttps(picUrl)
      return null
    }

    if (platform === 'tencent') {
      const normalized = normalizeTxMusicId(musicId)
      const result: any = await $fetch(
        'https://u.y.qq.com/cgi-bin/musicu.fcg',
        {
          method: 'POST',
          headers: txHeaders,
          body: createTxSongDetailBody(normalized),
          responseType: 'json',
          timeout: 10000
        }
      )
      if (result?.code !== 0 || result?.req?.code !== 0) return null
      const trackInfo = result.req?.data?.track_info
      const albumMid = trackInfo?.album?.mid || trackInfo?.albummid || trackInfo?.albumMid || ''
      if (albumMid && albumMid !== '空') {
        return `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`
      }
      return null
    }

    if (platform === 'migu') {
      const info: any = await $fetch(
        `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${encodeURIComponent(musicId)}`,
        { timeout: 10000 }
      )
      const item = info?.data?.[0]
      const img = item?.img2 || item?.img3 || item?.img1 || ''
      if (typeof img === 'string' && img) {
        return /^https?:/.test(img) ? img : `https://d.musicapp.migu.cn${img}`
      }
      return null
    }

    if (platform === 'bilibili') {
      // musicId 格式为 bvid:cid 或 bvid:cid:page
      const parts = String(musicId).split(':')
      const bvid = parts[0]
      const page = parts.length > 2 ? Number(parts[2]) : 1
      if (!bvid || (parts.length > 2 && (!Number.isInteger(page) || page < 1))) return null
      const viewResp: any = await $fetch('https://api.bilibili.com/x/web-interface/view', {
        params: { bvid },
        headers: { Cookie: 'buvid3=0', Referer: 'https://www.bilibili.com/' },
        timeout: 10000
      })
      if (viewResp?.code !== 0) return null
      const pageIdx = page > 1 ? Math.max(0, page - 1) : 0
      const pic = viewResp?.data?.pages?.[pageIdx]?.pic || viewResp?.data?.pic
      if (typeof pic === 'string' && pic) return upgradeHttps(pic)
      return null
    }
  } catch {
    // 外部接口失败时静默降级
  }
  return null
}
