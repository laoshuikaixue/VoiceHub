import { createHash } from 'node:crypto'
import { formatPlayTime } from '../../../utils/native_common'
import { getServerLocation } from '../../../utils/geo'
import { getServerTimestamp } from '../../../utils/serverTime'

// 咪咕 v3 搜索签名
function createSignature(time: string, str: string) {
  const deviceId = '963B7AA0D21511ED807EE5846EC87D20'
  const signatureMd5 = '6cdc72a439cef99a3418d2a78aa28c73'
  const sign = createHash('md5')
    .update(`${str}${signatureMd5}yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${time}`)
    .digest('hex')
  return { sign, deviceId }
}

// 仅搜索歌曲
const MIGU_SEARCH_SWITCH = JSON.stringify({
  song: 1,
  album: 0,
  singer: 0,
  tagSong: 1,
  mvSong: 0,
  bestShow: 1,
  songlist: 0,
  lyricSong: 0
})

const MIGU_ANDROID_UA =
  'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'

// 咪咕歌曲信息缓存（封面兜底用），避免重复请求
const mgSongInfoCache = new Map<string, { expiresAt: number; img: string }>()
const MG_INFO_CACHE_TTL = 6 * 60 * 60 * 1000

/**
 * 搜索结果封面缺失时，通过歌曲信息接口兜底取大图
 */
async function getMgCover(contentId: string): Promise<string> {
  const cached = mgSongInfoCache.get(contentId)
  if (cached) {
    if (cached.expiresAt > getServerTimestamp()) return cached.img
    mgSongInfoCache.delete(contentId)
  }

  try {
    const res: any = await $fetch(
      `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${contentId}`,
      { timeout: 10000 }
    )
    const song = res?.data?.[0]
    const img = song?.img || song?.albumImgs?.[0] || song?.bigImage || ''
    if (img) {
      mgSongInfoCache.set(contentId, { expiresAt: getServerTimestamp() + MG_INFO_CACHE_TTL, img })
    }
    return img
  } catch {
    return ''
  }
}

/**
 * 咪咕 v3 搜索接口（jadeite，带 MD5 签名，仅国内服务器可访问）
 */
async function searchV3(str: string, page: number, limit: number) {
  const time = getServerTimestamp().toString()
  const { sign, deviceId } = createSignature(time, str)
  const response: any = await $fetch(
    `https://jadeite.migu.cn/music_search/v3/search/searchAll` +
      `?isCorrect=0&isCopyright=1&searchSwitch=${encodeURIComponent(MIGU_SEARCH_SWITCH)}` +
      `&pageSize=${limit}&text=${encodeURIComponent(str)}&pageNo=${page}&sort=0&sid=USS`,
    {
      headers: {
        uiVersion: 'A_music_3.6.1',
        deviceId,
        timestamp: time,
        sign,
        channel: '0146921',
        'User-Agent': MIGU_ANDROID_UA
      },
      timeout: 10000
    }
  )

  if (!response || response.code !== '000000') {
    throw createError({ statusCode: 502, message: 'Migu API Error' })
  }

  // resultList 为分组结构（每组一个数组），需拍平
  const groups = response.songResultData?.resultList || []

  // 处理歌曲列表（封面缺失时兜底查询）
  const list = await Promise.all(
    groups
      .flatMap((group: any[]) => group)
      .filter((item: any) => item?.contentId || item?.songId)
      .map(async (item: any) => {
        // 歌手列表处理
        const singerList = item.singerList || []
        const singer = singerList.map((s: any) => s.name).join('/') || '未知艺术家'

        // 封面图（相对路径补全域名；缺失时经歌曲信息接口兜底）
        const img = item.img3 || item.img2 || item.img1 || ''
        const cover = img && !/^https?:/.test(img) ? `https://d.musicapp.migu.cn${img}` : img
        const contentId = item.contentId || item.songId
        const finalCover = cover || (contentId ? await getMgCover(contentId) : '')

        // 音质格式列表
        const formats = item.audioFormats?.map((f: any) => f.formatType) || []

        return {
          singer,
          name: item.name || item.songName || '',
          albumName: item.album || '',
          albumId: item.albumId || '',
          source: 'mg',
          interval: formatPlayTime(item.duration || 0),
          duration: item.duration || 0,
          songmid: contentId,
          copyrightId: item.copyrightId || '',
          img: finalCover,
          lrc: item.lrcUrl || null,
          mrcUrl: item.mrcurl || null,
          types: formats,
          _types: {},
          typeUrl: {}
        }
      })
  )

  return {
    list,
    total: response.songResultData?.totalCount || list.length
  }
}

/**
 * 咪咕旧版搜索接口（app.c.nf.migu.cn，海外服务器可访问）
 */
async function searchLegacy(str: string, page: number, limit: number) {
  const response: any = await $fetch('https://app.c.nf.migu.cn/bmw/search/song/v1.0', {
    params: {
      pageNo: page,
      text: str
    },
    timeout: 10000
  })

  if (!response?.data) {
    throw createError({ statusCode: 502, message: 'Migu API Error' })
  }

  const items = response.data.items || []

  // 处理歌曲列表（封面缺失时兜底查询）
  const list = await Promise.all(
    items.map(async (item: any) => {
      const song = item.song
      if (!song) return null

      // 歌手列表处理
      const singerList = song.singerList || []
      const singer = singerList.map((s: any) => s.name).join('/') || '未知艺术家'

      // 封面图（缺失时经歌曲信息接口兜底）
      const img = song.img2 ? `https://d.musicapp.migu.cn${song.img2}` : ''
      const contentId = song.contentId
      const finalCover = img || (contentId ? await getMgCover(contentId) : '')

      // 音质格式列表
      const formats = song.audioFormats?.map((f: any) => f.formatType) || []

      return {
        singer,
        name: song.songName || '',
        albumName: song.album || '',
        albumId: song.albumId || '',
        source: 'mg',
        interval: formatPlayTime(song.duration || 0),
        duration: song.duration || 0,
        songmid: contentId,
        copyrightId: '',
        img: finalCover,
        lrc: song.lrcUrl || null,
        mrcUrl: null,
        types: formats,
        _types: {},
        typeUrl: {}
      }
    })
  ).then((l) => l.filter(Boolean))

  return {
    list,
    total: response.data.totalCount || list.length
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const str = query.str as string
  const page = parseInt((query.page as string) || '1')
  const limit = parseInt((query.limit as string) || '30')

  if (!str) {
    throw createError({ statusCode: 400, message: 'Missing search query' })
  }

  try {
    // V3 接口会拦截海外服务器请求，按服务器地域选择接口
    const { isInChina } = await getServerLocation()

    let result
    if (isInChina) {
      try {
        result = await searchV3(str, page, limit)
      } catch (err) {
        console.warn('[mg.get] V3 接口请求失败，回退到旧版接口:', err)
        result = await searchLegacy(str, page, limit)
      }
    } else {
      result = await searchLegacy(str, page, limit)
    }

    return {
      ...result,
      page,
      limit,
      source: 'mg'
    }
  } catch (err: any) {
    console.error('[mg.get] 咪咕搜索失败:', err)
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || 'Internal Server Error'
    })
  }
})
