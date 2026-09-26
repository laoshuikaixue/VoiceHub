/**
 * 机器人点歌的音源取数层。
 *
 * 封装各平台的原始搜索调用，只返回「原始条目数组」，不做映射；
 * 映射逻辑在 astrbot-song-search.ts 的 normalizeAstrbotSongCandidates。
 *
 * 这一层**不**通过 /api/* 自请求，直接复用同进程的 utils，
 * 避免 HTTP 往返延迟和鉴权绕过风险。
 */

import { wyEapiRequest } from './native_wy'
import { createTxSearchBody, txRequest } from './native_tx'
import { searchQqMusic } from './qq_music_sdk'
import { searchMiguSongs } from './native_mg'
import { biConvertSong, searchBilibiliVideos } from './native_bilibili'
import type { AstrbotSongSource } from './astrbot-song-search'

/** 搜索单页最多取多少条（取够就截断，节省上游开销）。 */
const PAGE_LIMIT = 20

/**
 * 按音源取原始搜索条目。
 *
 * 返回的数组结构与对应的 native-api/search/*.get.ts 返回的 list 一致，
 * 供 normalizeAstrbotSongCandidates 消费。
 */
export async function fetchAstrbotSongSource(
  source: AstrbotSongSource,
  keyword: string,
  page: number
): Promise<unknown> {
  switch (source) {
    case 'netease': {
      const offset = PAGE_LIMIT * (page - 1)
      const result: any = await wyEapiRequest('/api/cloudsearch/pc', {
        s: keyword,
        type: 1,
        limit: PAGE_LIMIT,
        total: page === 1,
        offset
      })
      if (!result || result.code !== 200) return []
      const songs = result.result?.songs || []
      return songs.map((item: any) => ({
        singer: Array.isArray(item.ar) ? item.ar.map((s: any) => s.name).join('、') : '',
        name: item.name || '',
        albumName: item.al?.name || '',
        albumId: item.al?.id || '',
        source: 'wy',
        duration: item.dt ? item.dt / 1000 : 0,
        songmid: item.id,
        img: item.al?.picUrl || ''
      }))
    }

    case 'tencent': {
      // 优先走 SDK（QQ 官方接口），失败退回 tx 直连
      try {
        const sdkResult: any = await searchQqMusic({ keyword, page, num: PAGE_LIMIT })
        if (sdkResult?.list?.length) return sdkResult.list
      } catch {
        // SDK 失败，降级到 tx 直连
      }
      const body = createTxSearchBody(keyword, page, PAGE_LIMIT)
      const result: any = await txRequest(
        'https://u.y.qq.com/cgi-bin/musicu.fcg',
        body
      )
      const list = result?.req_0?.data?.body?.song?.list || []
      return list.map((item: any) => {
        const singers = Array.isArray(item.singer)
          ? item.singer.map((s: any) => s.name).join('、')
          : ''
        return {
          singer: singers,
          name: item.name || item.title || '',
          albumName: item.album?.name || '',
          albumId: item.album?.mid || '',
          source: 'tx',
          duration: Number(item.interval || item.duration || 0),
          songmid: item.mid || item.id,
          songId: item.id,
          strMediaMid: item.file?.media_mid || item.mid,
          img: item.album?.mid
            ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.album.mid}.jpg`
            : ''
        }
      })
    }

    case 'migu': {
      const result = await searchMiguSongs(keyword, page, PAGE_LIMIT)
      return result?.list || []
    }

    case 'bilibili': {
      const tracks = await searchBilibiliVideos(keyword)
      return tracks
    }

    default:
      return []
  }
}
