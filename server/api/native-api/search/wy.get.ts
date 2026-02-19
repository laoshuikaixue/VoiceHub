import { wyEapiRequest } from '../../../utils/native_wy'
import { formatPlayTime, sizeFormate } from '../../../utils/native_common'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const str = query.str as string
  const page = parseInt((query.page as string) || '1')
  const limit = parseInt((query.limit as string) || '30')

  if (!str) {
    throw createError({ statusCode: 400, message: 'Missing search query' })
  }

  const offset = limit * (page - 1)

  const data = {
    s: str,
    type: 1, // 1: 单曲
    limit,
    total: page === 1,
    offset
  }

  try {
    const result: any = await wyEapiRequest('/api/cloudsearch/pc', data)

    if (!result || result.code !== 200) {
      throw createError({ statusCode: 502, message: 'Netease API Error' })
    }

    const songs = result.result?.songs || []

    // 处理歌曲列表，参考 LX Music 的 handleResult 逻辑
    const list = songs.map((item: any) => {
      const types: any[] = []
      const _types: any = {}
      let size

      if (item.privilege.maxBrLevel == 'hires') {
        size = item.hr ? sizeFormate(item.hr.size) : null
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = { size }
      }

      switch (item.privilege.maxbr) {
        case 999000:
          size = item.sq ? sizeFormate(item.sq.size) : null
          types.push({ type: 'flac', size })
          _types.flac = { size }
        // LX 代码中有意为之的 switch 贯穿 (fallthrough)
        case 320000:
          size = item.h ? sizeFormate(item.h.size) : null
          types.push({ type: '320k', size })
          _types['320k'] = { size }
        // 贯穿
        case 192000:
        case 128000:
          size = item.l ? sizeFormate(item.l.size) : null
          types.push({ type: '128k', size })
          _types['128k'] = { size }
      }
      types.reverse()

      return {
        singer: item.ar.map((s: any) => s.name).join('、'),
        name: item.name,
        albumName: item.al.name,
        albumId: item.al.id,
        source: 'wy',
        interval: formatPlayTime(item.dt / 1000),
        duration: item.dt / 1000,
        songmid: item.id,
        img: item.al.picUrl,
        lrc: null,
        types,
        _types,
        typeUrl: {}
      }
    })

    return {
      list,
      total: result.result?.songCount || 0,
      page,
      limit,
      source: 'wy'
    }
  } catch (err) {
    console.error(err)
    throw createError({ statusCode: 500, message: 'Internal Server Error' })
  }
})
