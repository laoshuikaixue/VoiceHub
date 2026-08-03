import { formatPlayTime } from '../../../utils/native_common'

/**
 * 咪咕网页 v5 搜索接口
 */
async function searchPC(str: string, page: number, limit: number) {
  const response: any = await $fetch(
    `https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=${encodeURIComponent(str)}` +
      `&pageSize=${limit}&pageNo=${page}`,
    {
      headers: {
        Origin: 'https://music.migu.cn',
        Referer: 'https://music.migu.cn/v5',
        birth: 'h5page',
        channel: '014X031'
      },
      timeout: 10000
    }
  )

  // v5 接口直接返回歌曲扁平数组，无 total 字段
  if (!Array.isArray(response)) throw createError({ statusCode: 502, message: 'Migu PC API Error' })

  const list = await Promise.all(
    response
      .filter((item: any) => item?.contentId)
      .map(async (item: any) => {
        // 歌手列表处理
        const singerList = item.singerList || []
        const singer = singerList.map((s: any) => s.name).join('/') || '未知艺术家'

        // 封面图（相对路径补全域名）
        const img = item.img2 || item.img3 || item.img1 || ''
        const cover = img && !/^https?:/.test(img) ? `https://d.musicapp.migu.cn${img}` : img
        const contentId = item.contentId

        // 音质格式列表
        const formats = item.audioFormats?.map((f: any) => f.formatType) || ['PQ']

        return {
          singer,
          name: item.songName || item.name || '',
          albumName: item.album || '',
          albumId: item.albumId || '',
          source: 'mg',
          interval: formatPlayTime(item.duration || 0),
          duration: item.duration || 0,
          songmid: contentId,
          copyrightId: item.copyrightId || '',
          img: cover,
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
    // v5 接口无 total 字段，按当前页数量推算（满页则视为还有下一页）
    total: list.length < limit ? (page - 1) * limit + list.length : page * limit + 1
  }
}

/**
 * 咪咕移动端搜索接口（app.c.nf.migu.cn，海外服务器可访问）
 */
async function searchMobile(str: string, page: number, limit: number) {
  const response: any = await $fetch('https://app.c.nf.migu.cn/bmw/search/song/v1.0', {
    params: {
      pageNo: page,
      text: str
    },
    timeout: 10000
  })

  if (!response?.data) {
    throw createError({ statusCode: 502, message: 'Migu Mobile API Error' })
  }

  const items = response.data.items || []

  const list = await Promise.all(
    items
      // contentId 位于 item.song 内，而非 item 顶层
      .filter((item: any) => item?.song?.contentId)
      .map(async (item: any) => {
        const song = item.song

        // 歌手列表处理
        const singerList = song.singerList || []
        const singer = singerList.map((s: any) => s.name).join('/') || '未知艺术家'

        // 封面图（相对路径补全域名）
        const img = song.img2 ? `https://d.musicapp.migu.cn${song.img2}` : ''
        const contentId = song.contentId

        // 音质格式列表
        const formats = song.audioFormats?.map((f: any) => f.formatType) || ['PQ']

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
          img: img,
          lrc: song.lrcUrl || null,
          mrcUrl: null,
          types: formats,
          _types: {},
          typeUrl: {}
        }
      })
  )

  return {
    list,
    // 移动端接口无 total 字段，按当前页数量推算（满页则视为还有下一页）
    total: list.length < limit ? (page - 1) * limit + list.length : page * limit + 1
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
    let result
    try {
      result = await searchPC(str, page, limit)
    } catch (err) {
      console.warn('[mg.get] 咪咕网页 v5 接口请求失败，回退到移动端接口:', err)
      result = await searchMobile(str, page, limit)
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
