import {
  checkQQLoginQr,
  getLyric,
  getMusicPlay,
  getQQLoginQr
} from '@sansenjian/qq-music-api/sdk'
import { upgradeTxAudioUrl } from '~~/server/utils/native_tx'

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

const unwrapQqSdkResponse = (response: QqSdkResponse, fallbackMessage: string) => {
  const status = Number(response?.status || 500)
  const body = response?.body || {}

  if (status >= 400 || body.error) {
    throw new Error(String(body.error || body.message || fallbackMessage))
  }

  return body
}

const decodeMaybeBase64 = (value: unknown) => {
  if (typeof value !== 'string' || !value) return ''

  try {
    const decoded = Buffer.from(value, 'base64').toString()
    return decoded || value
  } catch {
    return value
  }
}

const normalizeQqSdkQuality = (quality: unknown) => {
  const key = String(quality ?? '8').toLowerCase()
  return QQ_SDK_QUALITY_MAP[key] || '320'
}

export const resolveQqSdkPlayUrl = async (
  songmid: string,
  quality?: unknown,
  cookie?: string
) => {
  const body = unwrapQqSdkResponse(
    await getMusicPlay({
      songmid,
      quality: normalizeQqSdkQuality(quality),
      cookie
    }),
    'qq-music-api 未返回播放链接'
  )

  const playUrl = body?.data?.playUrl
  const url =
    playUrl?.[songmid]?.url ||
    Object.values(playUrl || {}).find((item: any) => item?.url)?.url

  if (!url || typeof url !== 'string') {
    throw new Error('qq-music-api 未返回播放链接')
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
  const body = unwrapQqSdkResponse(
    await getLyric({
      songmid,
      songid,
      isFormat: false,
      cookie
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
