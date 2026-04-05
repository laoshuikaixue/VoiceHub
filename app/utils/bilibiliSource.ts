export interface ParsedBilibiliId {
  bvid: string
  cid?: string
}

export function parseBilibiliId(id: string | number): ParsedBilibiliId {
  const idStr = String(id)

  if (idStr.includes(':')) {
    const parts = idStr.split(':')
    return {
      bvid: parts[0],
      cid: parts[1]
    }
  }

  return {
    bvid: idStr
  }
}

/**
 * 判断是否为哔哩哔哩歌曲
 * @param song 歌曲对象
 * @returns boolean
 */
export function isBilibiliSong(song: any): boolean {
  if (!song) return false

  // 如果有手动填入的 playUrl，则不认为是哔哩哔哩歌曲
  // 因为手动投稿的歌曲可能来自任何平台，应该直接使用 playUrl 播放
  if (song.playUrl && song.playUrl.trim()) {
    return false
  }

  const musicPlatform = song.musicPlatform || song.actualMusicPlatform || ''
  const musicId = String(song.musicId || song.id || '')

  return (
    musicPlatform === 'bilibili' ||
    musicId.startsWith('BV') ||
    musicId.startsWith('av')
  )
}

export async function getBilibiliTrackUrl(id: string, cid?: string) {
  try {
    const params: any = { id }
    if (cid) {
      params.cid = cid
    }
    const data = await $fetch('/api/bilibili/playurl', {
      params
    })
    return data
  } catch (error) {
    console.error('Bilibili track url error:', error)
    throw error
  }
}

export async function searchBilibili(keyword: string) {
  try {
    const data = await $fetch<any[]>('/api/bilibili/search', {
      params: { keyword }
    })
    return data || []
  } catch (error) {
    console.error('Bilibili search error:', error)
    return []
  }
}
