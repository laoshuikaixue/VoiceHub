import { and, eq, isNull } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { schedules, songCollaborators, songs, musicSourcePlugins } from '~/drizzle/schema'
import { normalizeForMatch } from '~/utils/song-name-normalize'
import { getSystemSettingsCached } from '../system-settings-helper'
import { MUSIC_PLUGIN_LIMITS as limits, MUSIC_PLUGIN_LX_SOURCES, MUSIC_SOURCE_PLATFORMS } from '../../config/constants'
import { getServerTimestamp } from '../serverTime'
import { availablePlugins, listPluginRows, pluginRevision, prelude } from './store'
import { runPlugin } from './runtime'
import { seal, unseal } from './tickets'
import { pluginError } from './errors'
import { networkUrl, requestNetwork } from './network'
import { legacyPluginPlatformKey, pluginIdFromPlatform, pluginPlatformKey } from './platform'
import type { PluginArtifact, PluginTrack } from './types'

const failures = new Map<string, { count: number; until: number }>()
const cache = new Map<string, { expires: number; result: any }>()
const resolving = new Map<string, Promise<any>>()
const CACHE_SIZE = 200

export async function enabledCatalog(catalog?: string | null) {
  if (!catalog || !(MUSIC_SOURCE_PLATFORMS as readonly string[]).includes(catalog)) return true
  const settings = await getSystemSettingsCached()
  try {
    const parsed = JSON.parse(settings?.enabledPlatforms || 'null')
    const valid = Array.isArray(parsed) ? parsed.filter((p) => (MUSIC_SOURCE_PLATFORMS as readonly string[]).includes(p)) : []
    return !valid.length || valid.includes(catalog)
  } catch { return true }
}

async function call(artifact: PluginArtifact, action: string, params: unknown, signal?: AbortSignal) {
  const [row] = await db.select().from(musicSourcePlugins).where(and(eq(musicSourcePlugins.id, artifact.id), isNull(musicSourcePlugins.deletedAt)))
  if (!row?.enabled) throw pluginError('PLUGIN_UNAVAILABLE')
  const revision = await pluginRevision(artifact.id, artifact.revision)
  if (!(await enabledCatalog(revision.catalog))) throw pluginError('PLUGIN_UNAVAILABLE')
  return (await runPlugin({ source: artifact.source, prelude: await prelude(), protocol: artifact.protocol, variables: unseal(revision.variables, 'variables'), action, params, signal })).result
}

export function readSelection(token: string, userId: number, platform?: string, musicId?: string): PluginTrack {
  const data = unseal<{ userId: number; track: PluginTrack }>(token, 'selection')
  const trackPlatform = data.track.pluginId ? pluginPlatformKey(data.track.pluginId) : ''
  const legacyTrackPlatform = data.track.pluginId ? legacyPluginPlatformKey(data.track.pluginId) : ''
  if (data.userId !== userId || (platform && platform !== trackPlatform && platform !== legacyTrackPlatform) || (musicId && String(musicId) !== data.track.externalId)) throw pluginError('PLUGIN_INVALID_TICKET', 400)
  return data.track
}

// 无选择票据时按歌曲 ID 解析，可见性与播放列表保持一致：已正式发布排期、本人投稿/协作者、或歌曲管理角色
async function resolvableBySongId(songId: number, user: { id: number; role: string }) {
  if (['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true
  const [own] = await db.select({ id: songs.id }).from(songs).where(and(eq(songs.id, songId), eq(songs.requesterId, user.id))).limit(1)
  if (own) return true
  const [collab] = await db.select({ id: songCollaborators.id }).from(songCollaborators).where(and(eq(songCollaborators.songId, songId), eq(songCollaborators.userId, user.id))).limit(1)
  if (collab) return true
  const [published] = await db.select({ id: schedules.id }).from(schedules).where(and(eq(schedules.songId, songId), eq(schedules.isDraft, false))).limit(1)
  return !!published
}

export async function requestTrack(body: any, user: { id: number; role: string }): Promise<PluginTrack> {
  if (body.selectionToken) return readSelection(body.selectionToken, user.id)
  if (body.songId) {
    if (!Number.isSafeInteger(Number(body.songId)) || Number(body.songId) < 1) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
    if (!(await resolvableBySongId(Number(body.songId), user))) throw pluginError('PLUGIN_UNAVAILABLE', 403)
    const [song] = await db.select().from(songs).where(eq(songs.id, Number(body.songId)))
    if (!song) throw pluginError('PLUGIN_UNAVAILABLE', 404)
    if (song.musicSourceData) return song.musicSourceData as PluginTrack
    body = { platform: song.musicPlatform, musicId: song.musicId, title: song.title, artist: song.artist, duration: song.durationSeconds }
  }
  const platform = String(body.platform || '')
  const externalId = String(body.musicId || '').trim()
  if (!externalId || externalId.length > 200 || platform.length > 100) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  let pluginId: string | undefined
  const key = pluginIdFromPlatform(platform)
  if (key !== null) {
    pluginId = (await listPluginRows()).find((p) => p.id === key || p.legacyPlatformKey === key)?.id
    if (!pluginId) throw pluginError('PLUGIN_UNAVAILABLE')
  }
  return { schemaVersion: 1, catalog: platform, externalId, pluginId, title: String(body.title || '').slice(0, 200), artist: String(body.artist || '').slice(0, 200), album: String(body.album || '').slice(0, 200), duration: Number(body.duration) || undefined }
}

export async function pluginCapabilities() {
  const result = []
  for (const { row, artifact } of await availablePlugins()) {
    const revision = await pluginRevision(row.id, artifact.revision)
    if (!(await enabledCatalog(revision.catalog))) continue
    result.push({ id: row.id, platform: pluginPlatformKey(row.id), displayName: row.name, protocol: artifact.capability.protocol, search: artifact.capability.search, sources: artifact.capability.sources })
  }
  return result
}

export async function searchPlugins(query: string, page: number, id: string, userId: number) {
  if (!query.trim() || query.length > 200) throw pluginError('PLUGIN_INVALID_CONFIG', 400)
  const plugins = await availablePlugins()
  const target = plugins.find(({ row }) => row.id === id || row.legacyPlatformKey === id)
  if (!target?.artifact.capability.search) throw pluginError('PLUGIN_UNAVAILABLE')
  const result = await call(target.artifact, 'search', { query, page: Math.max(1, Math.floor(page) || 1) })
  const data = []
  const revision = await pluginRevision(target.row.id, target.artifact.revision)
  for (const item of (Array.isArray(result?.data) ? result.data : []).slice(0, 50)) {
    if (!item || typeof item !== 'object' || JSON.stringify(item).length > limits.itemBytes) continue
    const externalId = String(item.id ?? '')
    const title = String(item.title || item.name || '').slice(0, 200)
    const artist = String(item.artist || item.singer || '').slice(0, 200)
    if (!externalId || externalId.length > 200 || !title || !artist) continue
    const track: PluginTrack = { schemaVersion: 1, pluginId: target.row.id, catalog: revision.catalog || pluginPlatformKey(target.row.id), externalId, title, artist, album: String(item.album || ''), duration: Number(item.duration) || undefined, item }
    const platform = pluginPlatformKey(target.row.id)
    data.push({ id: externalId, musicId: externalId, title, artist, album: track.album, duration: track.duration, cover: String(item.artwork || item.cover || '') || null, musicPlatform: platform, actualMusicPlatform: platform, pluginId: target.row.id, selectionToken: seal({ userId, track }, 'selection', 2 * 60 * 60 * 1000), sourceInfo: { source: 'plugin', plugin: target.row.id } })
  }
  return { data, isEnd: result?.isEnd !== false }
}

function matchItem(items: any[], track: PluginTrack) {
  if (!track.title || !track.artist) return null
  const matches = items.filter((item) => {
    if (normalizeForMatch(item.title || item.name) !== normalizeForMatch(track.title) || normalizeForMatch(item.artist || item.singer) !== normalizeForMatch(track.artist)) return false
    const duration = Number(item.duration)
    if (duration && track.duration && Math.abs(duration - track.duration) > 5) return false
    if (track.album && item.album && normalizeForMatch(item.album) !== normalizeForMatch(track.album)) return false
    return !!item.id && JSON.stringify(item).length <= limits.itemBytes
  })
  return matches.length === 1 ? matches[0] : null
}

async function itemFor(artifact: PluginArtifact, track: PluginTrack, signal: AbortSignal) {
  const revision = await pluginRevision(artifact.id, artifact.revision)
  if (artifact.capability.protocol === 'musicfree') {
    if (track.pluginId === artifact.id && track.item) return { ...track.item, id: track.externalId }
    if (!artifact.capability.search) return null
    const result = await call(artifact, 'search', { query: `${track.title} ${track.artist}`, page: 1 }, signal)
    return matchItem(Array.isArray(result?.data) ? result.data : [], track)
  }
  const catalog = track.catalog
  const source = MUSIC_PLUGIN_LX_SOURCES[catalog]
  if (!source || !artifact.capability.sources[source]?.actions.includes('musicUrl')) return null
  if (revision.catalog && revision.catalog !== catalog) return null
  const raw = track.item || {}
  const songmid = track.externalId
  const meta = { ...(raw.meta || {}), songId: songmid, albumName: track.album || '', albumId: raw.albumId || '' }
  const item: Record<string, any> = { id: songmid, songmid, songId: songmid, source, name: track.title, singer: track.artist, albumName: track.album || '', albumId: raw.albumId || '', meta }
  for (const field of ['hash', 'strMediaMid', 'copyrightId', 'types', '_types']) {
    const value = raw[field] || raw.meta?.[field]
    if (value) { item[field] = value; item.meta[field] = value }
  }
  return item
}

export async function resolvePlugins(track: PluginTrack, quality: string, excluded: string[], userId: number, signal?: AbortSignal, preferProxy = false) {
  if (!(await enabledCatalog(track.catalog))) throw pluginError('PLUGIN_UNAVAILABLE')
  const deadline = getServerTimestamp() + limits.batchMs
  const budget = AbortSignal.any([AbortSignal.timeout(limits.batchMs), ...(signal ? [signal] : [])])
  const attempted = [...new Set(excluded)].slice(0, 40)
  for (const { row, artifact } of await availablePlugins()) {
    const resolverId = `plugin:${row.id}:${artifact.hash}`
    if (attempted.includes(resolverId) || excluded.includes(`plugin:${row.id}`)) continue
    if ((failures.get(resolverId)?.until || 0) > getServerTimestamp()) continue
    if (deadline - getServerTimestamp() < 1000) return { success: false, attempted, more: true, continuation: seal({ track, quality, attempted, userId }, 'continuation', 60000) }
    attempted.push(resolverId)
    const key = JSON.stringify([resolverId, artifact.revision, track, quality, userId])
    try {
      const remembered = cache.get(key)
      let media = remembered && remembered.expires > getServerTimestamp() ? remembered.result : null
      if (!media) {
        let pending = resolving.get(key)
        if (!pending) {
          pending = (async () => {
            const item = await itemFor(artifact, track, budget)
            if (!item) return null
            const source = MUSIC_PLUGIN_LX_SOURCES[track.catalog] || ''
            const desired = artifact.capability.protocol === 'lx' ? ({ standard: '128k', high: '320k', super: 'flac', lossless: 'flac24bit' }[quality] || '320k') : quality
            const levels = artifact.capability.protocol === 'lx' ? artifact.capability.sources[source]?.qualities || [] : ['standard', 'high', 'super', 'lossless']
            const q = levels.includes(desired) ? desired : levels.includes('320k') ? '320k' : levels[0] || desired
            for (const candidateQuality of [...new Set([q, artifact.capability.protocol === 'lx' ? '128k' : 'standard'])]) {
              if (levels.length && !levels.includes(candidateQuality)) continue
              try {
                const result = await call(artifact, 'musicUrl', { item, source, quality: candidateQuality }, budget)
                const url = typeof result === 'string' ? result : result?.url
                if (typeof url !== 'string' || !url) continue
                networkUrl(url)
                const headers = result?.headers || (result?.userAgent ? { 'User-Agent': result.userAgent } : {})
                if (!headers || typeof headers !== 'object' || Array.isArray(headers) || JSON.stringify(headers).length > 12000) continue
                return { url, headers, quality: candidateQuality }
              } catch { if (budget.aborted) throw pluginError('PLUGIN_TIMEOUT') }
            }
            return null
          })().finally(() => resolving.delete(key))
          resolving.set(key, pending)
        }
        media = await pending
      }
      if (!media) continue
      cache.set(key, { expires: getServerTimestamp() + 60000, result: media })
      while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
      failures.delete(resolverId)
      const [current] = await db.select().from(musicSourcePlugins).where(eq(musicSourcePlugins.id, row.id))
      if (!current?.enabled || current.deletedAt) continue
      // preferProxy：客户端需要在页面里直接读取响应体（如批量下载），此时不能返回跨域直链
      const proxy = preferProxy || Object.keys(media.headers || {}).length > 0 || media.url.startsWith('http:')
      const url = proxy ? `/api/music-source-plugins/media?ticket=${seal({ ...media, pluginId: row.id, catalog: track.catalog, userId }, 'media', 30 * 60 * 1000)}` : media.url
      return { success: true, url, source: resolverId, pluginId: row.id, attempted, quality: media.quality, playbackMode: proxy ? 'proxy' : 'direct', more: false }
    } catch (error) {
      // 沙箱并发饱和（503）属容量问题，不计入熔断，否则高峰期会把健康插件集体拉黑 30 秒
      if ((error as any)?.statusCode === 503) continue
      const old = failures.get(resolverId)
      const count = (old?.count || 0) + 1
      failures.set(resolverId, { count, until: count >= 3 ? getServerTimestamp() + 30000 : 0 })
      while (failures.size > 100) failures.delete(failures.keys().next().value!)
    }
  }
  return { success: false, attempted, more: false }
}

export async function pluginLyric(track: PluginTrack) {
  for (const { artifact } of await availablePlugins()) {
    if (!artifact.capability.lyric || artifact.id !== track.pluginId) continue
    const item = await itemFor(artifact, track, AbortSignal.timeout(limits.callMs))
    if (!item) return null
    const result = await call(artifact, 'lyric', { item })
    let rawLrc = result?.rawLrc
    if (!rawLrc && /^https?:\/\//.test(result?.lrc || '')) {
      const response = await requestNetwork(result.lrc, { signal: AbortSignal.timeout(limits.callMs) }, 512000)
      if (response.status === 200) rawLrc = response.bytes.toString('utf8')
    }
    return { rawLrc: typeof rawLrc === 'string' ? rawLrc : '', translation: typeof result?.translation === 'string' ? result.translation : '' }
  }
  return null
}
