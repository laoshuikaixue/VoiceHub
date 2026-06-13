import {
  checkQQLoginQr,
  getLyric,
  getMusicPlay,
  getQQLoginQr,
  search
} from '@sansenjian/qq-music-api/sdk'
import { getUserAvatar } from '@sansenjian/qq-music-api/services'
import { txHeaders, upgradeTxAudioUrl, zzcSign } from '~~/server/utils/native_tx'

type QqSdkResponse = {
  status: number
  body?: Record<string, any>
}

const QQ_SDK_QUALITY_MAP: Record<string, string> = {
  '4': '128',
  '8': '320',
  '10': 'flac',
  '11': 'flac',
  '14': 'flac',
  '128': '128',
  '320': '320',
  '128k': '128',
  '320k': '320',
  flac: 'flac',
  sq: 'flac',
  hires: 'flac'
}

const QQ_AUTH_COOKIE_KEYS = ['qqmusic_key', 'qm_keyst', 'music_key']
const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
const QQ_MUSICS_URL = 'https://u.y.qq.com/cgi-bin/musics.fcg'
const QQ_PLAY_GUID = '1429839143'
const QQ_COMMON_QUERY = {
  g_tk: '1124214810',
  hostUin: '0',
  inCharset: 'utf8',
  outCharset: 'utf-8',
  notice: '0',
  platform: 'yqq.json',
  needNewCode: '0'
}
const QQ_OFFICIAL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  referer: 'https://y.qq.com/portal/player.html',
  host: 'u.y.qq.com',
  'content-type': 'application/x-www-form-urlencoded'
}

const QQ_PLAY_FILE_TYPE_MAP: Record<string, { prefix: string; suffix: string }> = {
  m4a: { prefix: 'C400', suffix: '.m4a' },
  '128': { prefix: 'M500', suffix: '.mp3' },
  '320': { prefix: 'M800', suffix: '.mp3' },
  flac: { prefix: 'F000', suffix: '.flac' }
}

const unwrapQqSdkResponse = (response: QqSdkResponse, fallbackMessage: string) => {
  const status = Number(response?.status || 500)
  const body = response?.body || {}

  if (status >= 400 || body.error) {
    throw new Error(String(body.error || body.message || fallbackMessage))
  }

  return body
}

const parseCookieObject = (cookie?: string) => {
  const result: Record<string, string> = {}
  if (!cookie) return result

  cookie.split(';').forEach((item) => {
    const separatorIndex = item.indexOf('=')
    if (separatorIndex <= 0) return

    const key = item.slice(0, separatorIndex).trim()
    const value = item.slice(separatorIndex + 1).trim()
    if (key && value) result[key] = value
  })

  return result
}

const serializeCookieObject = (cookieObject: Record<string, string>) => {
  return Object.entries(cookieObject)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

export const normalizeQqCookie = (cookie?: string) => {
  const cookieObject = parseCookieObject(cookie)
  const fallbackKey = cookieObject.qm_keyst || cookieObject.music_key || cookieObject.qqmusic_key
  if (fallbackKey) {
    cookieObject.qqmusic_key = fallbackKey
  }

  return serializeCookieObject(cookieObject)
}

export const getQqCookieDiagnostic = (cookie?: string) => {
  const normalizedCookie = normalizeQqCookie(cookie)
  const cookieObject = parseCookieObject(normalizedCookie)
  const authKeys = QQ_AUTH_COOKIE_KEYS.filter((key) => Boolean(cookieObject[key]))

  return {
    hasCookie: Boolean(normalizedCookie),
    hasUin: Boolean(cookieObject.uin),
    uinType: cookieObject.uin?.startsWith('o') ? 'openid' : (cookieObject.uin ? 'uin' : 'missing'),
    hasAuthKey: authKeys.length > 0,
    authKeySource: cookieObject.qm_keyst
      ? 'qm_keyst'
      : (cookieObject.music_key ? 'music_key' : (cookieObject.qqmusic_key ? 'qqmusic_key' : 'missing')),
    authKeys
  }
}

const decodeMaybeBase64 = (value: unknown) => {
  if (typeof value !== 'string' || !value) return ''

  const normalizedValue = value.trim()
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedValue) || normalizedValue.length % 4 !== 0) {
    return value
  }

  try {
    const decoded = Buffer.from(normalizedValue, 'base64').toString()
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(decoded)) {
      return value
    }
    if (!/[\r\n[\]\u4e00-\u9fa5]/.test(decoded)) {
      return value
    }
    return decoded || value
  } catch {
    return value
  }
}

const isHttpAudioUrl = (value: string) => /^https?:\/\//i.test(value.trim())

const findFirstUrl = (value: unknown): string => {
  if (!value) return ''

  if (typeof value === 'string') {
    return isHttpAudioUrl(value) ? value : ''
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findFirstUrl(item)
      if (url) return url
    }
    return ''
  }

  if (typeof value === 'object') {
    const record = value as Record<string, any>
    if (typeof record.url === 'string' && isHttpAudioUrl(record.url)) {
      return record.url
    }

    for (const item of Object.values(record)) {
      const url = findFirstUrl(item)
      if (url) return url
    }
  }

  return ''
}

const collectPlayUrlErrors = (value: unknown): string[] => {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPlayUrlErrors(item))
  }

  if (typeof value === 'object') {
    const record = value as Record<string, any>
    const currentError = typeof record.error === 'string' ? [record.error] : []
    return [
      ...currentError,
      ...Object.values(record).flatMap((item) => collectPlayUrlErrors(item))
    ]
  }

  return []
}

const normalizeQqSdkQuality = (quality: unknown) => {
  const key = String(quality ?? '8').toLowerCase()
  return QQ_SDK_QUALITY_MAP[key] || '320'
}

const pickPlayableDomain = (sip: unknown) => {
  if (!Array.isArray(sip)) return ''

  const urls = sip.filter((item) => typeof item === 'string' && item.length > 0)
  return urls.find((url) => !url.startsWith('http://ws')) ||
    urls.find((url) => url.startsWith('https://')) ||
    urls[0] ||
    ''
}

const joinUrl = (domain: string, path: string) => {
  if (domain.endsWith('/') && path.startsWith('/')) return `${domain}${path.slice(1)}`
  if (!domain.endsWith('/') && !path.startsWith('/')) return `${domain}/${path}`
  return `${domain}${path}`
}

const buildQqOfficialPlayUrl = (
  domain: string,
  info: Record<string, any> | undefined,
  guid: string
) => {
  if (!domain || !info) return ''
  if (info.purl) return joinUrl(domain, info.purl)
  if (info.vkey && info.filename) {
    return `${joinUrl(domain, info.filename)}?vkey=${info.vkey}&guid=${guid}&fromtag=66`
  }
  return ''
}

const resolveQqVkeyUin = (cookieObject: Record<string, string>) => {
  return cookieObject.uin || '0'
}

const requestQqOfficialVkey = async (
  payload: Record<string, any>,
  cookie: string,
  useSignedRequest: boolean
) => {
  const headers: Record<string, string> = useSignedRequest
    ? { ...txHeaders }
    : { ...QQ_OFFICIAL_HEADERS }
  if (cookie) headers.Cookie = cookie

  if (useSignedRequest) {
    return await $fetch<any>(`${QQ_MUSICS_URL}?sign=${await zzcSign(JSON.stringify(payload))}`, {
      method: 'POST',
      headers,
      body: payload,
      responseType: 'json',
      signal: AbortSignal.timeout(6000)
    })
  }

  return await $fetch<any>(QQ_MUSICU_URL, {
    method: 'GET',
    headers,
    query: {
      ...QQ_COMMON_QUERY,
      loginUin: payload.loginUin || '0',
      format: 'json',
      data: JSON.stringify(payload)
    },
    responseType: 'json',
    signal: AbortSignal.timeout(6000)
  })
}

const parseQqOfficialPlayUrl = (
  response: Record<string, any> | undefined,
  songmid: string,
  guid: string
) => {
  const data = response?.req_0?.data
  const domain = pickPlayableDomain(data?.sip)
  const midurlinfo = Array.isArray(data?.midurlinfo) ? data.midurlinfo : []
  const info = midurlinfo.find((item: Record<string, any>) => item?.songmid === songmid) ||
    midurlinfo[0]
  const url = buildQqOfficialPlayUrl(domain, info, guid)

  return {
    url,
    info
  }
}

const createQqOfficialVkeyPayload = ({
  songmid,
  filename,
  guid,
  uin,
  authst
}: {
  songmid: string
  filename: string
  guid: string
  uin: string
  authst?: string
}) => {
  return {
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        filename: [filename],
        guid,
        songmid: [songmid],
        songtype: [0],
        uin,
        loginflag: 1,
        platform: '20',
        ...(authst ? { authst } : {})
      }
    },
    loginUin: uin,
    comm: {
      uin,
      format: 'json',
      ct: 24,
      cv: 0
    }
  }
}

export const resolveQqOfficialPlayUrl = async ({
  songmid,
  quality,
  cookie,
  mediaId
}: {
  songmid: string
  quality?: unknown
  cookie?: string
  mediaId?: string
}) => {
  const normalizedCookie = normalizeQqCookie(cookie)
  const cookieObject = parseCookieObject(normalizedCookie)
  const qualityKey = normalizeQqSdkQuality(quality)
  const fileType = QQ_PLAY_FILE_TYPE_MAP[qualityKey] || QQ_PLAY_FILE_TYPE_MAP['320']
  const playableFileId = String(mediaId || songmid || '').trim()
  const songmidValue = String(songmid || '').trim()

  if (!songmidValue) {
    throw new Error('QQ 官方接口缺少 songmid')
  }
  if (!playableFileId) {
    throw new Error('QQ 官方接口缺少播放文件 ID')
  }

  const guid = QQ_PLAY_GUID
  const uin = resolveQqVkeyUin(cookieObject)
  const filename = `${fileType.prefix}${playableFileId}${fileType.suffix}`
  const payload = createQqOfficialVkeyPayload({
    songmid: songmidValue,
    filename,
    guid,
    uin,
    authst: cookieObject.qqmusic_key
  })

  let url: string | undefined
  let info: Record<string, any> | undefined

  try {
    const normalResponse = await requestQqOfficialVkey(payload, normalizedCookie, false)
    const parsed = parseQqOfficialPlayUrl(normalResponse, songmidValue, guid)
    url = parsed.url
    info = parsed.info
  } catch (normalErr) {
    console.warn('[qq_music_sdk] 未签名请求失败，尝试签名请求:', normalErr)
  }

  if (!url) {
    try {
      const signedResponse = await requestQqOfficialVkey(payload, normalizedCookie, true)
      const signedResult = parseQqOfficialPlayUrl(signedResponse, songmidValue, guid)
      url = signedResult.url || url
      info = signedResult.info || info
    } catch (signedErr) {
      console.error('[qq_music_sdk] 签名请求也失败，保留已获取的诊断信息:', signedErr)
    }
  }

  if (!url) {
    const resultCode = info?.result === undefined ? 'missing' : String(info.result)
    const subcode = info?.subcode === undefined ? 'missing' : String(info.subcode)
    const mid = info?.mid || 'missing'
    const tips = info?.tips ? `, tips=${String(info.tips)}` : ''
    throw new Error(
      `QQ 官方接口未返回播放链接：filename=${filename}, result=${resultCode}, subcode=${subcode}, mid=${mid}, purl=${Boolean(info?.purl)}, vkey=${Boolean(info?.vkey)}${tips}`
    )
  }

  return upgradeTxAudioUrl(url)
}

export const resolveQqSdkPlayUrl = async (
  songmid: string,
  quality?: unknown,
  cookie?: string,
  mediaId?: string
) => {
  const normalizedCookie = normalizeQqCookie(cookie)
  const body = unwrapQqSdkResponse(
    await getMusicPlay({
      songmid,
      quality: normalizeQqSdkQuality(quality),
      mediaId,
      cookie: normalizedCookie
    }),
    'qq-music-api 未返回播放链接'
  )

  const data = body?.response || body?.data || body
  const url =
    findFirstUrl(data?.url) ||
    findFirstUrl(data?.playUrl?.[songmid]) ||
    findFirstUrl(data?.playUrl)

  if (!url || typeof url !== 'string') {
    const errors = collectPlayUrlErrors(data?.playUrl?.[songmid] || data?.playUrl)
    const diagnostic = getQqCookieDiagnostic(normalizedCookie)
    const reason = errors.length ? `：${[...new Set(errors)].join('、')}` : ''
    const authHint = diagnostic.hasCookie
      ? `（Cookie: uin=${diagnostic.hasUin ? `present:${diagnostic.uinType}` : 'missing'}, authKey=${diagnostic.hasAuthKey ? `${diagnostic.authKeys.join('/')}, used=${diagnostic.authKeySource}` : 'missing'}）`
      : '（未传 Cookie）'
    throw new Error(`qq-music-api 未返回播放链接${reason}${authHint}`)
  }

  return upgradeTxAudioUrl(url)
}

export const resolveQqSdkLyric = async ({
  songmid,
  songid,
  cookie
}: {
  songmid?: string
  songid?: string
  cookie?: string
}) => {
  const normalizedCookie = normalizeQqCookie(cookie)
  const body = unwrapQqSdkResponse(
    await getLyric({
      songmid,
      songid,
      isFormat: false,
      cookie: normalizedCookie
    }),
    'qq-music-api 未返回歌词'
  )

  const data = body.response || body.data || body
  const lrc = typeof data?.lyric === 'string'
    ? data.lyric
    : decodeMaybeBase64(data?.lrc)
  const trans = decodeMaybeBase64(data?.trans)

  if (!lrc) {
    throw new Error('qq-music-api 未返回歌词')
  }

  return { lrc, trans }
}

export const getQqLoginQr = async () => {
  const body = unwrapQqSdkResponse(await getQQLoginQr(), '获取 QQ 登录二维码失败')
  return body.response || body.data || body
}

export const checkQqLogin = async (ptqrtoken: string | number, qrsig: string) => {
  const body = unwrapQqSdkResponse(
    await checkQQLoginQr({ ptqrtoken, qrsig }),
    '检查 QQ 登录状态失败'
  )
  return body.response || body.data || body
}

export const getQqUserAvatar = async ({
  uin,
  k,
  size = 140
}: {
  uin?: string
  k?: string
  size?: number
}) => {
  return await getUserAvatar({ uin, k, size })
}

export const searchQqMusic = async ({
  key,
  limit,
  page,
  cookie
}: {
  key: string
  limit?: number
  page?: number
  cookie?: string
}) => {
  const normalizedCookie = normalizeQqCookie(cookie)
  const body = unwrapQqSdkResponse(
    await search({
      key,
      limit,
      page,
      option: normalizedCookie
        ? { headers: { Cookie: normalizedCookie } }
        : undefined
    }),
    'qq-music-api 搜索失败'
  )

  return body.response || body.data || body
}
