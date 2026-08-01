import crypto from 'node:crypto'

export const txHeaders = {
  'User-Agent': 'QQMusic 14090508(android 12)'
}

const TX_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
const QQ_MID_PREFIX_RE = /^qqmid:/i
const QQ_LEGACY_ID_RE = /^\d+$/
const TX_DETAIL_CACHE_TTL = 6 * 60 * 60 * 1000

// 签名算法常量
const PART_1_INDEXES = [23, 14, 6, 36, 16, 40, 7, 19]
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5]
const SCRAMBLE_VALUES = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179]

function pickHashByIdx(hash: string, indexes: number[]) {
  return indexes.map((idx) => hash[idx]).join('')
}

function base64Encode(data: Buffer | string) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/[\\/+=]/g, '')
}

/**
 * zzcSign 签名算法
 * 模拟官方客户端签名，抗封锁能力更强
 */
export async function zzcSign(text: string) {
  const hash = crypto.createHash('sha1').update(text).digest('hex')
  const part1 = pickHashByIdx(hash, PART_1_INDEXES)
  const part2 = pickHashByIdx(hash, PART_2_INDEXES)
  const part3 = SCRAMBLE_VALUES.map((value, i) => value ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16))
  const b64Part = base64Encode(Buffer.from(part3)).replace(/[\\/+=]/g, '')
  return `zzc${part1}${b64Part}${part2}`.toLowerCase()
}

/**
 * 使用签名请求 QQ 音乐 API
 * 相比普通 musicu.fcg，musics.fcg?sign=... 的签名请求更稳定
 */
export const txSignedRequest = async (body: any) => {
  const sign = await zzcSign(JSON.stringify(body))
  try {
    const response = await $fetch(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`, {
      method: 'POST',
      headers: txHeaders,
      body,
      responseType: 'json'
    })
    return response
  } catch (error) {
    console.error('TX Signed Request Error:', error)
    throw error
  }
}

type TxIdType = 'legacy-id' | 'mid'

interface TxNormalizedMusicId {
  rawMusicId: string
  normalizedMusicId: string
  idType: TxIdType
}

interface TxSongPlayableInfo extends TxNormalizedMusicId {
  songmid: string
  songId?: string
  strMediaMid?: string
}

const txSongDetailCache = new Map<
  string,
  {
    expiresAt: number
    value: TxSongPlayableInfo
  }
>()

/**
 * PC 客户端版 searchid：32 位大写十六进制 GUID + 5 位补零随机数（37 字符）
 */
const getTxSearchId = () => {
  let guid = ''
  for (let i = 0; i < 32; i++) guid += Math.floor(Math.random() * 16).toString(16)
  return guid.toUpperCase() + String(Math.floor(Math.random() * 100000)).padStart(5, '0')
}

export const createTxSearchBody = (str: string, page: number, limit: number) => {
  return {
    comm: {
      _channelid: '0',
      _os_version: '6.2.9200-2',
      ct: '19',
      cv: '2151',
      guid: '1F70E520B2EAA7D25E11760783C53CA9',
      patch: '118',
      psrf_access_token_expiresAt: 0,
      psrf_qqaccess_token: '',
      psrf_qqopenid: '',
      psrf_qqunionid: '',
      tmeAppID: 'qqmusic',
      tmeLoginType: 0,
      uin: '0',
      wid: '7223299733393904640'
    },
    'music.search.SearchCgiService': {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: {
        grp: 1,
        num_per_page: limit,
        page_num: page,
        query: str,
        remoteplace: 'txt.newclient.top',
        search_type: 0,
        searchid: getTxSearchId()
      }
    }
  }
}

export const normalizeTxMusicId = (musicId: string | number): TxNormalizedMusicId => {
  const rawMusicId = String(musicId ?? '').trim()
  const normalizedMusicId = rawMusicId.replace(QQ_MID_PREFIX_RE, '').trim()

  if (!normalizedMusicId) {
    throw createError({ statusCode: 400, message: '缺少 QQ 音乐ID' })
  }

  return {
    rawMusicId,
    normalizedMusicId,
    idType: QQ_LEGACY_ID_RE.test(normalizedMusicId) ? 'legacy-id' : 'mid'
  }
}

export const upgradeTxAudioUrl = (url: string) => {
  return url.startsWith('http://') ? url.replace('http://', 'https://') : url
}

export const createTxSongDetailBody = (musicId: TxNormalizedMusicId) => {
  const param =
    musicId.idType === 'legacy-id'
      ? { song_type: 0, song_id: Number(musicId.normalizedMusicId) }
      : { song_type: 0, song_mid: musicId.normalizedMusicId }

  return {
    comm: {
      ct: '19',
      cv: '1859',
      uin: '0'
    },
    req: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail_yqq',
      param
    }
  }
}

const getCachedTxSongDetail = (key: string) => {
  const cached = txSongDetailCache.get(key)
  if (!cached) return null

  if (cached.expiresAt <= Date.now()) {
    txSongDetailCache.delete(key)
    return null
  }

  return cached.value
}

const setCachedTxSongDetail = (key: string, value: TxSongPlayableInfo) => {
  if (txSongDetailCache.size >= 1000) {
    const firstKey = txSongDetailCache.keys().next().value
    if (firstKey !== undefined) {
      txSongDetailCache.delete(firstKey)
    }
  }
  txSongDetailCache.set(key, {
    expiresAt: Date.now() + TX_DETAIL_CACHE_TTL,
    value
  })
}

export const getTxSongPlayableInfo = async (
  musicId: string | number
): Promise<TxSongPlayableInfo> => {
  const normalized = normalizeTxMusicId(musicId)
  const cacheKey = `${normalized.idType}:${normalized.normalizedMusicId}`
  const cached = getCachedTxSongDetail(cacheKey)
  if (cached) return cached

  // 旧 QQ 数字 ID 只在播放时转 MID，避免批量改历史数据。
  let result: any
  try {
    result = await txRequest(TX_MUSICU_URL, createTxSongDetailBody(normalized))
  } catch (error) {
    if (normalized.idType === 'mid') {
      const value = {
        ...normalized,
        songmid: normalized.normalizedMusicId
      }
      setCachedTxSongDetail(cacheKey, value)
      return value
    }
    throw error
  }

  if (!result || result.code !== 0 || result.req?.code !== 0) {
    if (normalized.idType === 'mid') {
      const value = {
        ...normalized,
        songmid: normalized.normalizedMusicId
      }
      setCachedTxSongDetail(cacheKey, value)
      return value
    }
    throw createError({ statusCode: 502, message: 'QQ 音乐详情接口异常' })
  }

  const trackInfo = result.req?.data?.track_info
  const songmid = trackInfo?.mid || normalized.normalizedMusicId
  if (!songmid) {
    throw createError({ statusCode: 502, message: 'QQ 音乐详情缺少 MID' })
  }

  const value = {
    ...normalized,
    songmid,
    songId: String(trackInfo?.id || normalized.normalizedMusicId),
    strMediaMid: trackInfo?.file?.media_mid
  }

  setCachedTxSongDetail(cacheKey, value)
  setCachedTxSongDetail(`mid:${songmid}`, {
    ...value,
    normalizedMusicId: songmid,
    idType: 'mid'
  })

  return value
}

export const txRequest = async (url: string, body: any) => {
  try {
    const response = await $fetch(url, {
      method: 'POST',
      headers: txHeaders,
      body,
      responseType: 'json'
    })
    return response
  } catch (error) {
    console.error('TX Request Error:', error)
    throw error
  }
}
