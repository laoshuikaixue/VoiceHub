/**
 * Bilibili 搜索的共用实现（原 server/api/bilibili/search.get.ts 内联逻辑外移）。
 *
 * 抽出的原因：机器人点歌需要在**不**自请求 /api/bilibili/search 的前提下复用同一套
 * 上游调用与条目转换，放 utils 里让 HTTP 端点与机器人回调共用一份实现。
 * 代码参考 https://github.com/ljk743121/Sound-of-experiment/blob/v4/server/utils/plugins/bilibili.ts
 */
import xss from 'xss'

export interface BilibiliSearchSongInfo {
  id: number
  bvid: string
  title: string
  author: string
  pic: string
  duration: string
}

export interface BilibiliVideoPage {
  cid: number
  page: number
  part: string
  duration: number
}

export interface BilibiliVideoInfoRes {
  code: number
  message: string
  data: {
    pages: BilibiliVideoPage[]
  }
}

export interface BilibiliSearchRes {
  code: number
  message: string
  data: {
    result: [BilibiliSearchSongInfo]
  }
}

/** Bilibili 搜索结果的条目结构（biConvertSong 输出）。 */
export interface BilibiliTrack {
  id: string
  title: string
  artist: string
  source: 'bilibili'
  musicPlatform: 'bilibili'
  cover: string
  duration: number
  album: string
  pages: BilibiliVideoPage[]
}

const BILIBILI_HEADERS = {
  Cookie: 'buvid3=0',
  Referer: 'https://www.bilibili.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

function htmlToPlainText(value: string) {
  return xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  })
}

export function biConvertSong(song_info: BilibiliSearchSongInfo, pages?: BilibiliVideoPage[]): BilibiliTrack {
  let imgUrl = song_info.pic
  const durationStr = song_info.duration
    .split(':')
    .map((x) => Number.parseInt(x))
    .reverse()
  let duration = durationStr[0] + durationStr[1] * 60
  if (durationStr.length === 3) {
    duration += durationStr[2] * 60 * 60
  }
  if (imgUrl.startsWith('//')) {
    imgUrl = `https:${imgUrl}`
  }
  const track: BilibiliTrack = {
    id: song_info.bvid,
    title: htmlToPlainText(song_info.title),
    artist: htmlToPlainText(song_info.author),
    source: 'bilibili',
    musicPlatform: 'bilibili',
    cover: imgUrl,
    duration,
    album: 'Bilibili Video',
    pages: pages || []
  }
  return track
}

/** 按关键词搜索视频并逐条补充分 P（detail 失败时退回搜索条目本身）。 */
export async function searchBilibiliVideos(keyword: string, pageSize = 15): Promise<BilibiliTrack[]> {
  const resp = await $fetch<BilibiliSearchRes>('https://api.bilibili.com/x/web-interface/search/type', {
    method: 'GET',
    params: {
      __refresh__: true,
      page: 1,
      page_size: pageSize,
      platform: 'pc',
      highlight: 1,
      single_column: 0,
      keyword,
      search_type: 'video',
      dynamic_offset: 0,
      preload: true,
      com2co: true
    },
    headers: BILIBILI_HEADERS
  })

  if (!resp.data?.result) return []

  return await Promise.all(
    resp.data.result.map(async (song) => {
      try {
        const videoInfoResp = await $fetch<BilibiliVideoInfoRes>('https://api.bilibili.com/x/web-interface/view', {
          method: 'GET',
          params: { bvid: song.bvid },
          headers: BILIBILI_HEADERS
        })

        const pages = videoInfoResp.data?.pages || []
        return biConvertSong(song, pages)
      } catch (error) {
        console.error(`Failed to fetch video info for ${song.bvid}:`, error)
        return biConvertSong(song)
      }
    })
  )
}
