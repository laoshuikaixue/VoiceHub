import { createTxSearchBody, txRequest, txSignedRequest } from '../../../utils/native_tx'
import { decodeName, formatPlayTime, sizeFormate } from '../../../utils/native_common'
import { searchQqMusic } from '~~/server/utils/qq_music_sdk'

const stripHtml = (value: unknown) => String(value || '').replace(/<[^>]*>/g, '')

const formatSdkSearchList = (items: any[]) => {
  return items.map((item: any) => {
    const songmid = item.songmid || item.mid
    const strMediaMid = item.strMediaMid || item.media_mid || item.file?.media_mid || songmid
    const albumMid = item.albummid || item.albumMid || item.album?.mid || ''
    const singers = Array.isArray(item.singer)
      ? item.singer.map((s: any) => s.name).filter(Boolean).join('、')
      : item.singer || ''
    const interval = Number(item.interval || item.duration || 0)
    const types = []
    const _types: any = {}

    if (Number(item.size128 || item.file?.size_128mp3 || 0) !== 0) {
      const size = sizeFormate(Number(item.size128 || item.file?.size_128mp3))
      types.push({ type: '128k', size })
      _types['128k'] = { size }
    }
    if (Number(item.size320 || item.file?.size_320mp3 || 0) !== 0) {
      const size = sizeFormate(Number(item.size320 || item.file?.size_320mp3))
      types.push({ type: '320k', size })
      _types['320k'] = { size }
    }
    if (Number(item.sizeflac || item.file?.size_flac || 0) !== 0) {
      const size = sizeFormate(Number(item.sizeflac || item.file?.size_flac))
      types.push({ type: 'flac', size })
      _types.flac = { size }
    }

    return {
      singer: decodeName(stripHtml(singers).replace(/、/g, '、')),
      name: decodeName(stripHtml(item.songname || item.name || item.title)),
      albumName: decodeName(stripHtml(item.albumname || item.albumName || item.album?.name || '')),
      albumId: albumMid,
      source: 'tx',
      interval: formatPlayTime(interval),
      duration: interval,
      songId: item.songid || item.songId || item.id,
      albumMid,
      strMediaMid,
      songmid,
      img:
        albumMid === '' || albumMid === '空'
          ? item.singer?.length
            ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg`
            : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`,
      types,
      _types,
      typeUrl: {}
    }
  }).filter((item) => item.songmid)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const str = query.str as string
  const page = parseInt((query.page as string) || '1')
  const limit = parseInt((query.limit as string) || '50') // 腾讯接口默认每页 50 条

  if (!str) {
    throw createError({ statusCode: 400, message: 'Missing search query' })
  }

  const body = createTxSearchBody(str, page, limit)

  let result: any
  try {
    try {
      const sdkResult: any = await searchQqMusic({ key: str, page, limit })
      const sdkList = sdkResult?.song?.list || sdkResult?.data?.song?.list || []
      const list = formatSdkSearchList(sdkList)

      if (list.length > 0) {
        return {
          list,
          total: sdkResult?.song?.totalnum || sdkResult?.data?.song?.totalnum || list.length,
          page,
          limit,
          source: 'qq-music-api'
        }
      }
    } catch (sdkErr) {
      console.warn('[tx.get] qq-music-api 搜索失败，回退到原生搜索:', sdkErr)
    }

    try {
      result = await txSignedRequest(body)
    } catch (signedErr) {
      console.warn('[tx.get] 签名请求失败，回退到普通请求:', signedErr)
      result = await txRequest('https://u.y.qq.com/cgi-bin/musicu.fcg', body)
    }

    if (result.code !== 0 || result.req?.code !== 0) {
      throw createError({ statusCode: 502, message: 'Tencent API Error' })
    }

    const rawList = result.req.data.body.item_song || []

    const list = []
    for (const item of rawList) {
      if (!item.file?.media_mid) continue

      const types = []
      const _types: any = {}
      const file = item.file

      if (file.size_128mp3 != 0) {
        const size = sizeFormate(file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = { size }
      }
      if (file.size_320mp3 !== 0) {
        const size = sizeFormate(file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = { size }
      }
      if (file.size_flac !== 0) {
        const size = sizeFormate(file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = { size }
      }
      if (file.size_hires !== 0) {
        const size = sizeFormate(file.size_hires)
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = { size }
      }

      let albumId = ''
      let albumName = ''
      if (item.album) {
        albumName = item.album.name
        albumId = item.album.mid
      }

      const singerName = item.singer ? item.singer.map((s: any) => s.name).join('、') : ''

      list.push({
        singer: decodeName(singerName),
        name: decodeName(item.name + (item.title_extra ?? '')),
        albumName: decodeName(albumName),
        albumId,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        duration: item.interval,
        songId: item.id,
        albumMid: item.album?.mid ?? '',
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img:
          albumId === '' || albumId === '空'
            ? item.singer?.length
              ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg`
              : ''
            : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
        types,
        _types,
        typeUrl: {}
      })
    }

    return {
      list,
      total: result.req.data.meta.estimate_sum,
      page,
      limit,
      source: 'tx'
    }
  } catch (err) {
    console.error(err)
    throw createError({ statusCode: 500, message: 'Internal Server Error' })
  }
})
