import { defineEventHandler, getHeader, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { astrbotBindings, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getServerTimestamp } from '~~/server/utils/serverTime'
import {
  ASTRBOT_TOKEN_HEADER,
  equalAstrbotToken
} from '~~/server/utils/astrbot-notification'
import {
  adapterToAstrbotPlatform,
  isAstrbotPlatformEnabled,
  isAstrbotPrivateUmoShape
} from '~~/server/utils/astrbot-platforms'
import {
  ASTRBOT_SONG_TICKET_PURPOSE,
  ASTRBOT_SONG_TICKET_TTL_MS,
  normalizeAstrbotSongCandidates,
  searchSongs,
  type AstrbotSongSource,
  type SongCandidate
} from '~~/server/utils/astrbot-song-search'
import {
  detectSharePlatform,
  extractBilibiliBvid,
  extractNeteaseSongId,
  extractShareUrl,
  extractTencentSongId,
  isShortLink,
  isTrustedShareHost
} from '~~/server/utils/astrbot-share-link'
import { seal } from '~~/server/utils/music-source-plugins/tickets'

/** 短链跟随跳转的最大次数（163cn.tv、b23.tv 都是一次跳转）。 */
const SHORT_LINK_MAX_REDIRECTS = 3

/**
 * 按 ID 取单曲原始条目，结构与对应搜索条目一致，交给
 * normalizeAstrbotSongCandidates 映射。取不到时返回空数组。
 */
async function fetchSongRaw(platform: AstrbotSongSource, songId: string): Promise<unknown[]> {
  if (platform === 'netease') {
    const { wyEapiRequest } = await import('~~/server/utils/native_wy')
    const result: any = await wyEapiRequest('/api/v3/song/detail', {
      // v3 song/detail 的 c 必须是对象数组 JSON：[{"id":123}]，传 {"ids":"[123]"} 会被上游 400 拒绝
      c: JSON.stringify([{ id: Number(songId) }]),
      ids: `[${songId}]`
    })
    if (!result || result.code !== 200) return []
    const songs = Array.isArray(result.songs) ? result.songs : []
    return songs.map((item: any) => ({
      singer: Array.isArray(item.ar) ? item.ar.map((s: any) => s.name).join('、') : '',
      name: item.name || '',
      albumName: item.al?.name || '',
      albumId: item.al?.id || '',
      source: 'wy',
      duration: item.dt ? item.dt / 1000 : 0,
      songmid: item.id,
      img: item.al?.picUrl || ''
    }))
  }

  if (platform === 'tencent') {
    const { createTxSongDetailBody, normalizeTxMusicId, txRequest, TX_MUSICU_URL } =
      await import('~~/server/utils/native_tx')
    const result: any = await txRequest(TX_MUSICU_URL, createTxSongDetailBody(normalizeTxMusicId(songId)))
    const track = result?.req?.data?.track_info
    if (!track) return []
    return [{
      singer: Array.isArray(track.singer) ? track.singer.map((s: any) => s.name).join('、') : '',
      name: track.name || track.title || '',
      albumName: track.album?.name || '',
      albumId: track.album?.mid || '',
      source: 'tx',
      duration: Number(track.interval || 0),
      songmid: track.mid || songId,
      songId: track.id,
      strMediaMid: track.file?.media_mid || track.mid,
      img: track.album?.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${track.album.mid}.jpg` : ''
    }]
  }

  if (platform === 'bilibili') {
    const { $fetch } = await import('~~/server/utils/native_bilibili').then((mod) => ({ $fetch: (mod as any).$fetch ?? globalThis.$fetch }))
    const { biConvertSong } = await import('~~/server/utils/native_bilibili')
    const resp: any = await $fetch('https://api.bilibili.com/x/web-interface/view', {
      method: 'GET',
      params: { bvid: songId },
      headers: { Referer: 'https://www.bilibili.com/', Cookie: 'buvid3=0' }
    })
    const data = resp?.data
    if (!data?.bvid) return []
    const track = biConvertSong({
      id: data.aid,
      bvid: data.bvid,
      title: data.title || '',
      author: data.owner?.name || '',
      pic: data.pic || '',
      // view 接口的 duration 是秒数，biConvertSong 吃 "mm:ss" 字符串
      duration: formatBilibiliDuration(data.duration)
    }, data.pages || [])
    return [track]
  }

  return []
}

/** view 接口的秒数转 biConvertSong 期望的 "mm:ss"。 */
function formatBilibiliDuration(seconds: unknown): string {
  const total = typeof seconds === 'number' && seconds > 0 ? Math.floor(seconds) : 0
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** 跟随短链跳转拿到最终 URL（手动逐跳，只允许跳往已知音源域名，防 SSRF）。 */
async function followShortLink(url: string): Promise<string> {
  let current = url
  for (let hop = 0; hop < SHORT_LINK_MAX_REDIRECTS && isShortLink(current); hop += 1) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
    const location = response.headers.get('location')
    if (!location) break
    let next: string
    try {
      next = new URL(location, current).toString()
    } catch {
      break
    }
    if (!isTrustedShareHost(next) || next === current) break
    current = next
  }
  return current
}

/**
 * 机器人点歌的分享链接解析：识别网易云/QQ音乐/B站分享文本，
 * 解析出单曲候选并密封为与搜索同形的票据。确认投稿走既有 song-request。
 */
export default defineEventHandler(async (event) => {
  const [settings] = await db
    .select({
      token: systemSettings.astrbotToken,
      enabled: systemSettings.astrbotEnabled,
      platforms: systemSettings.astrbotPlatforms
    })
    .from(systemSettings)
    .limit(1)

  if (!settings?.enabled || !equalAstrbotToken(getHeader(event, ASTRBOT_TOKEN_HEADER) ?? '', settings.token ?? '')) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '机器人令牌无效')
  }

  const body = await readBody(event)
  const umo: unknown = body?.umo

  if (!isAstrbotPrivateUmoShape(umo)) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_UMO_INVALID, '私聊会话无效')
  }

  const [binding] = await db
    .select({ userId: astrbotBindings.userId, platform: astrbotBindings.platform, adapter: astrbotBindings.adapter })
    .from(astrbotBindings)
    .where(eq(astrbotBindings.umo, umo))
    .limit(1)

  if (!binding || !isAstrbotPlatformEnabled(settings.platforms, binding.platform) ||
    adapterToAstrbotPlatform(binding.adapter) !== binding.platform) {
    throw createApiError(403, SERVER_ERROR_CODES.ASTRBOT_UMO_UNBOUND, '该会话未绑定 VoiceHub 账号')
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text || text.length > 500) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_KEYWORD_INVALID, '分享内容无效')
  }

  const platform = detectSharePlatform(text)
  if (!platform) {
    throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '无法识别的分享链接，支持网易云音乐、QQ音乐、哔哩哔哩')
  }

  const url = extractShareUrl(text) ?? ''

  // 短链入口（163cn.tv/b23.tv/c6.y.qq.com）先跟随跳转拿到可解析的最终 URL
  const finalUrl = isShortLink(url) ? await followShortLink(url) : url
  let songId: string | null

  if (platform === 'netease') {
    songId = extractNeteaseSongId(finalUrl)
  } else if (platform === 'tencent') {
    songId = extractTencentSongId(finalUrl)
  } else {
    songId = extractBilibiliBvid(finalUrl)
  }

  let candidates: SongCandidate[] = []
  if (songId) {
    try {
      const raw = await fetchSongRaw(platform, songId)
      candidates = normalizeAstrbotSongCandidates(platform, raw)
    } catch (error) {
      // 上游失败降级到关键词兜底，第三方抖动不应让机器人回复 500
      console.warn('[astrbot-song-resolve] 详情获取失败，走关键词兜底:', error instanceof Error ? error.message : error)
    }
  }

  // ID 解析失败或详情接口拿不到时兜底：把整段文本（去链接）当关键词搜索
  if (!candidates.length) {
    const keyword = text.replace(/https?:\/\/\S+/gi, '').trim()
    if (!keyword) {
      throw createApiError(400, SERVER_ERROR_CODES.ASTRBOT_SONG_PLATFORM_INVALID, '无法从分享链接中识别歌曲')
    }
    candidates = await searchSongs(platform, keyword.slice(0, 100), 1)
    if (!candidates.length) {
      throw createApiError(404, SERVER_ERROR_CODES.ASTRBOT_SONG_INDEX_INVALID, '分享链接未能识别出歌曲，试试 /广播 点歌 关键词 搜索')
    }
  }

  const candidate = candidates[0]!
  const ticketCandidates = [candidate]

  const sessionToken = seal({
    umo,
    platform,
    keyword: candidate.title,
    createdAt: getServerTimestamp(),
    candidates: ticketCandidates
  }, ASTRBOT_SONG_TICKET_PURPOSE, ASTRBOT_SONG_TICKET_TTL_MS)

  return {
    success: true,
    platform,
    keyword: candidate.title,
    sessionToken,
    count: 1,
    items: [{
      index: 1,
      title: candidate.title,
      artist: candidate.artist,
      durationSeconds: candidate.durationSeconds
    }]
  }
})
