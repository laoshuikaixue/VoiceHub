import { getSyncedTimestamp } from '~/composables/useSyncedTime'

const BASE_URL = '/api/api-enhanced/netease'

export function normalizeNeteaseResponse(data) {
  if (!data || typeof data !== 'object') {
    return {
      code: undefined,
      message: '',
      body: undefined
    }
  }

  // 已是标准响应结构时直接返回
  if (data.code === 200 && data.data) {
    return {
      code: data.code,
      message: data.message || '',
      body: data.data // 统一映射到 body
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

export async function fetchNetease(endpoint, params = {}, cookie) {
  const query = new URLSearchParams()
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null) {
      query.append(key, params[key])
    }
  }
  if (cookie) {
    query.append('cookie', cookie)
  }
  query.append('timestamp', getSyncedTimestamp().toString())

  const url = `${BASE_URL}${endpoint}?${query.toString()}`
  const response = await fetch(url)
  const raw = await response.json()
  return normalizeNeteaseResponse(raw)
}

export async function getUserPlaylists(uid, cookie) {
  return fetchNetease('/user/playlist', { uid, limit: 100 }, cookie)
}

export async function createPlaylist(name, isPrivate, cookie) {
  const params = { name }
  if (isPrivate) {
    params.privacy = 10
  }
  return fetchNetease('/playlist/create', params, cookie)
}

export async function deletePlaylist(id, cookie) {
  return fetchNetease('/playlist/delete', { id }, cookie)
}

export async function addSongsToPlaylist(pid, tracks, cookie) {
  return fetchNetease('/playlist/tracks', { op: 'add', pid, tracks: tracks.join(',') }, cookie)
}

export async function getPlaylistDetail(id, cookie) {
  return fetchNetease('/playlist/detail', { id }, cookie)
}

export async function getPlaylistTracks(id, limit = 1000, offset = 0, cookie) {
  return fetchNetease('/playlist/track/all', { id, limit, offset }, cookie)
}

export async function getRecentSongs(limit = 100, cookie) {
  return fetchNetease('/record/recent/song', { limit }, cookie)
}

export async function getLoginStatus(cookie) {
  return fetchNetease('/login/status', {}, cookie)
}
