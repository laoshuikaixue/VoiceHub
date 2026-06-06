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

export const createTxSearchBody = (str: string, page: number, limit: number) => {
  return {
    comm: {
      ct: '11',
      cv: '14090508',
      v: '14090508',
      tmeAppID: 'qqmusic',
      phonetype: 'EBG-AN10',
      deviceScore: '553.47',
      devicelevel: '50',
      newdevicelevel: '20',
      rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
      os_ver: '12',
      OpenUDID: '0',
      OpenUDID2: '0',
      QIMEI36: '0',
      udid: '0',
      chid: '0',
      aid: '0',
      oaid: '0',
      taid: '0',
      tid: '0',
      wid: '0',
      uid: '0',
      sid: '0',
      modeSwitch: '6',
      teenMode: '0',
      ui_mode: '2',
      nettype: '1020',
      v4ip: ''
    },
    req: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicMobile',
      param: {
        search_type: 0,
        query: str,
        page_num: page,
        num_per_page: limit,
        highlight: 0,
        nqc_flag: 0,
        multi_zhida: 0,
        cat: 2,
        grp: 1,
        sin: 0,
        sem: 0
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

  if (normalized.idType === 'mid') {
    const value = {
      ...normalized,
      songmid: normalized.normalizedMusicId
    }
    setCachedTxSongDetail(cacheKey, value)
    return value
  }

  // 旧 QQ 数字 ID 只在播放时转 MID，避免批量改历史数据。
  const result: any = await txRequest(TX_MUSICU_URL, createTxSongDetailBody(normalized))

  if (!result || result.code !== 0 || result.req?.code !== 0) {
    throw createError({ statusCode: 502, message: 'QQ 音乐详情接口异常' })
  }

  const trackInfo = result.req?.data?.track_info
  const songmid = trackInfo?.mid
  if (!songmid) {
    throw createError({ statusCode: 502, message: 'QQ 音乐详情缺少 MID' })
  }

  const value = {
    ...normalized,
    songmid,
    songId: String(trackInfo.id || normalized.normalizedMusicId),
    strMediaMid: trackInfo.file?.media_mid
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
