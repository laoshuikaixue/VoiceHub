// QQ 音乐用户资料库（歌单）前端封装
const BASE_URL = '/api/native-api/qq'

// 归一化为弹窗通用曲目形状 {id, name, ar[], al, dt}
export const normalizeQqLibrarySong = (raw) => {
  // 兼容字符串数组与对象数组两种歌手形态
  const singerSource = Array.isArray(raw?.singer)
    ? raw.singer
    : Array.isArray(raw?.singers)
      ? raw.singers
      : []
  const ar = singerSource
    .map((item) =>
      typeof item === 'string' ? { name: item } : { name: String(item?.name || '') }
    )
    .filter((a) => a.name)

  const name = String(raw?.songname ?? raw?.name ?? raw?.title ?? '').trim()
  if (!name) return null

  const mid = String(raw?.songmid ?? raw?.mid ?? '')
  const albumMid = String(
    raw?.albumMid ?? raw?.albummid ?? raw?.album?.mid ?? ''
  )
  const albumName = String(
    raw?.albumName ?? raw?.albumname ?? raw?.album?.name ?? raw?.album?.title ?? ''
  ).trim()
  const interval = Number(raw?.interval) || 0

  return {
    id: mid,
    name,
    ar,
    al: {
      name: albumName,
      id: albumMid || undefined,
      picUrl: albumMid
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`
        : ''
    },
    // 投稿链路对非网易平台按时长秒处理
    dt: interval
  }
}

const postLibrary = async (endpoint, payload) => {
  const res = await $fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: payload
  })
  return res?.data || {}
}

export async function getQqUserPlaylists(cookie) {
  const data = await postLibrary('/playlists', { cookie })
  return Array.isArray(data.playlists) ? data.playlists : []
}

// QQ 音乐"我喜欢"虚拟歌单 id，playlist-songs 接口按此标志走专用链路
export const QQ_FAV_PLAYLIST_ID = '__qq_fav_songs__'

export async function getQqPlaylistSongs(disstid, cookie, limit = 100, offset = 0) {
  const isFav = disstid === QQ_FAV_PLAYLIST_ID
  const data = await postLibrary('/playlist-songs', {
    disstid: isFav ? '' : disstid,
    favSongs: isFav,
    cookie,
    limit,
    offset
  })
  const songs = (Array.isArray(data.songs) ? data.songs : [])
    .map(normalizeQqLibrarySong)
    .filter(Boolean)
  return {
    playlist: data.playlist || null,
    songs,
    total: Number(data.total) || songs.length,
    hasMore: offset + songs.length < (Number(data.total) || songs.length)
  }
}
