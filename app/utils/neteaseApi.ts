const BASE_URL = 'https://api.voicehub.lao-shui.top'

export const normalizeNeteaseResponse = (data) => {
  if (!data || typeof data !== 'object') {
    return {
      code: undefined,
      message: '',
      body: undefined
    }
  }

  // 检查是否已经是标准格式 { code: 200, data: ... }
  if (data.code === 200 && data.data) {
    return {
      code: data.code,
      message: data.message || '',
      body: data.data // 将 data 字段映射为 body
    }
  }

  const body =
    Object.prototype.hasOwnProperty.call(data, 'body') && data.body && typeof data.body === 'object'
      ? data.body
      : data
  const code = typeof body.code === 'number' ? body.code : undefined
  const message = typeof body.message === 'string' ? body.message : ''
  return {
    code,
    message,
    body
  }
}

export const fetchNetease = async (endpoint, params = {}, cookie) => {
  const query = new URLSearchParams()
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null) {
      query.append(key, params[key])
    }
  }
  if (cookie) {
    query.append('cookie', cookie)
  }
  query.append('timestamp', Date.now().toString())

  const url = `${BASE_URL}${endpoint}?${query.toString()}`
  const response = await fetch(url)
  const raw = await response.json()
  return normalizeNeteaseResponse(raw)
}

export const getUserPlaylists = async (uid, cookie) => {
  return fetchNetease('/user/playlist', { uid, limit: 100 }, cookie)
}

export const createPlaylist = async (name, isPrivate, cookie) => {
  const params = { name }
  if (isPrivate) {
    params.privacy = 10
  }
  return fetchNetease('/playlist/create', params, cookie)
}

export const deletePlaylist = async (id, cookie) => {
  return fetchNetease('/playlist/delete', { id }, cookie)
}

export const addSongsToPlaylist = async (pid, tracks, cookie) => {
  return fetchNetease('/playlist/tracks', { op: 'add', pid, tracks: tracks.join(',') }, cookie)
}

export const getPlaylistTracks = async (id, limit = 1000, offset = 0, cookie) => {
  return fetchNetease('/playlist/track/all', { id, limit, offset }, cookie)
}

export const getRecentSongs = async (limit = 100, cookie) => {
  return fetchNetease('/record/recent/song', { limit }, cookie)
}

export const getLoginStatus = async (cookie) => {
  return fetchNetease('/login/status', {}, cookie)
}
