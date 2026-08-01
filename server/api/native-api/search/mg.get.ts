import { formatPlayTime } from '../../../utils/native_common'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const str = query.str as string
  const page = parseInt((query.page as string) || '1')
  const limit = parseInt((query.limit as string) || '30')

  if (!str) {
    throw createError({ statusCode: 400, message: 'Missing search query' })
  }

  try {
    // 咪咕音乐搜索 API
    const response: any = await $fetch('http://app.c.nf.migu.cn/bmw/search/song/v1.0', {
      params: {
        pageNo: page,
        text: str
      },
      timeout: 10000
    })

    if (!response || !response.data) {
      throw createError({ statusCode: 502, message: 'Migu API Error' })
    }

    const items = response.data.items || []

    // 处理歌曲列表
    const list = items.map((item: any) => {
      const song = item.song
      if (!song) return null

      // 歌手列表处理
      const singerList = song.singerList || []
      const singer = singerList.map((s: any) => s.name).join('/') || '未知艺术家'

      // mid image
      const img = song.img2 ? `https://d.musicapp.migu.cn${song.img2}` : ''

      const formats = song.audioFormats?.map((f: any) => f.formatType) || []

      return {
        singer,
        name: song.songName || '',
        albumName: song.album || '',
        albumId: song.albumId || '',
        source: 'mg',
        interval: formatPlayTime(song.duration || 0),
        duration: song.duration || 0,
        songmid: song.contentId,
        img,
        lrc: song.lrcUrl || null,
        types: formats,
        _types: {},
        typeUrl: {}
      }
    }).filter(Boolean)

    return {
      list,
      total: response.data.totalCount || list.length,
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