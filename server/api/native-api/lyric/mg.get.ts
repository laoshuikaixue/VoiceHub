import { requestNetwork } from '~~/server/utils/music-source-plugins/network'

// 咪咕 mrc 逐字歌词解密（TEA 算法）
const DELTA = BigInt('2654435769')
const MIN_LENGTH = 32
const keyArr = [
  BigInt('27303562373562475'),
  BigInt('18014862372307051'),
  BigInt('22799692160172081'),
  BigInt('34058940340699235'),
  BigInt('30962724186095721'),
  BigInt('27303523720101991'),
  BigInt('27303523720101998'),
  BigInt('31244139033526382'),
  BigInt('28992395054481524')
]

const toLong = (value: bigint | string): bigint => {
  const num = typeof value === 'string' ? BigInt('0x' + value) : value
  const MAX = BigInt('9223372036854775807')
  const MIN = BigInt('-9223372036854775808')
  if (num > MAX) return toLong(num - (BigInt(1) << BigInt(64)))
  if (num < MIN) return toLong(num + (BigInt(1) << BigInt(64)))
  return num
}

const longToBytes = (l: bigint): Buffer => {
  const result = Buffer.alloc(8)
  for (let i = 0; i < 8; i++) {
    result[i] = parseInt((l & BigInt('0xff')).toString())
    l >>= BigInt(8)
  }
  return result
}

const toBigintArray = (data: string): bigint[] => {
  const length = Math.floor(data.length / 16)
  const arr: bigint[] = []
  for (let i = 0; i < length; i++) {
    arr.push(toLong(data.substring(i * 16, i * 16 + 16)))
  }
  return arr
}

const teaDecrypt = (data: bigint[], key: bigint[]): bigint[] => {
  const length = data.length
  const lengthBigint = BigInt(length)
  if (length < 1) return data

  let j2 = data[0]!
  let j3 = toLong((BigInt(6) + BigInt(52) / lengthBigint) * DELTA)
  while (true) {
    const j4 = j3
    if (j4 === BigInt(0)) break
    const j5 = toLong(BigInt(3) & (j4 >> BigInt(2)))
    let j6 = lengthBigint
    while (true) {
      j6--
      if (j6 > BigInt(0)) {
        const j7 = data[Number(j6 - BigInt(1))]!
        const i = Number(j6)
        j2 = toLong(
          data[i]! -
            (toLong(toLong(j2 ^ j4) + toLong(j7 ^ key[Number(toLong((BigInt(3) & j6) ^ j5))]!)) ^
              toLong(
                toLong(toLong(j7 >> BigInt(5)) ^ toLong(j2 << BigInt(2))) +
                  toLong(toLong(j2 >> BigInt(3)) ^ toLong(j7 << BigInt(4)))
              ))
        )
        data[i] = j2
      } else {
        break
      }
    }
    const j8 = data[length - 1]!
    j2 = toLong(
      data[0]! -
        toLong(
          toLong(toLong(key[Number(toLong((j6 & BigInt(3)) ^ j5))]! ^ j8) + toLong(j2 ^ j4)) ^
            toLong(
              toLong(toLong(j8 >> BigInt(5)) ^ toLong(j2 << BigInt(2))) +
                toLong(toLong(j2 >> BigInt(3)) ^ toLong(j8 << BigInt(4)))
            )
        )
    )
    data[0] = j2
    j3 = toLong(j4 - DELTA)
  }
  return data
}

const longArrToString = (data: bigint[]): string => {
  return data.map((j) => longToBytes(j).toString('utf16le')).join('')
}

const decryptMrc = (data: string): string => {
  if (data == null || data.length < MIN_LENGTH) return data
  return longArrToString(teaDecrypt(toBigintArray(data), keyArr))
}

// mrc 逐字格式 `[startMs,durationMs]` 解析为普通逐行歌词 `[mm:ss.mmm]`
const parseMrcToLrc = (str: string): string => {
  const lines = str.split('\n')
  const lrcLines: string[] = []
  for (const line of lines) {
    if (line.length < 6) continue
    const timeMatch = /^\s*\[(\d+),\d+\]/.exec(line)
    const timeStr = timeMatch?.[1]
    if (!timeStr) continue

    const startTime = parseInt(timeStr)
    let time = startTime
    const ms = (time % 1000).toString().padStart(3, '0')
    time = Math.floor(time / 1000)
    const m = Math.floor(time / 60).toString().padStart(2, '0')
    const s = (time % 60).toString().padStart(2, '0')

    const words = line.replace(/^\s*\[(\d+),\d+\]/, '').replace(/\(\d+,\d+\)/g, '')
    lrcLines.push(`[${m}:${s}.${ms}]${words}`)
  }
  return lrcLines.join('\n')
}

// 歌词正文大小上限：正常歌词为几十 KB，超限说明目标不是歌词文件
const LYRIC_MAX_BYTES = 512 * 1024
const LYRIC_FETCH_TIMEOUT_MS = 8000

const MIGU_LYRIC_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36',
  Referer: 'https://app.c.nf.migu.cn/',
  channel: '0146921'
}

const fetchLyricText = async (url: string) => {
  // 出站统一走安全网络层：协议与内嵌凭据校验、私网/云元数据地址拒绝、DNS 结果钉扎、
  // 重定向逐跳复验、响应大小限制
  const { status, bytes } = await requestNetwork(
    url,
    { headers: MIGU_LYRIC_HEADERS, signal: AbortSignal.timeout(LYRIC_FETCH_TIMEOUT_MS) },
    LYRIC_MAX_BYTES
  )
  if (status < 200 || status >= 300) {
    throw createError({ statusCode: 502, message: `咪咕歌词接口返回 ${status}` })
  }
  return bytes.toString('utf8')
}

// 歌词地址只允许由 contentId 在服务端换取，不接受调用方传入 URL：
// 本接口匿名可达，透传 URL 等于开放内网与云元数据读取入口
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const contentId = typeof query.contentId === 'string' ? query.contentId.trim() : ''

  if (!contentId) {
    throw createError({ statusCode: 400, message: '缺少 contentId 参数' })
  }

  try {
    // 通过歌曲信息接口获取 lrcUrl/mrcUrl
    const songInfoResponse: any = await $fetch(
      `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${encodeURIComponent(contentId)}`,
      { timeout: 10000 }
    )

    const code = songInfoResponse?.code?.toString() || ''
    if (code !== '000000' || !songInfoResponse?.data?.length) {
      throw createError({ statusCode: 404, message: '未找到歌曲信息' })
    }

    const songData = songInfoResponse.data[0]

    // 优先使用 mrc 逐字歌词
    if (songData?.mrcUrl) {
      try {
        const mrcText = await fetchLyricText(songData.mrcUrl)
        const lrc = parseMrcToLrc(decryptMrc(mrcText))
        if (lrc && lrc.trim()) {
          return {
            success: true,
            data: { lrc, trans: '', yrc: '', ttml: '' }
          }
        }
      } catch (mrcErr) {
        console.warn('[mg.lyric] mrc 歌词解析失败，回退 lrc:', mrcErr)
      }
    }

    const songLrcUrl = songData?.lrcUrl
    if (!songLrcUrl) {
      throw createError({ statusCode: 404, message: '未找到歌词链接' })
    }

    // 获取歌词内容
    const lrcText = await fetchLyricText(songLrcUrl)
    if (!lrcText || !lrcText.trim()) {
      throw createError({ statusCode: 404, message: '歌词内容为空' })
    }

    return {
      success: true,
      data: {
        lrc: lrcText,
        trans: '',
        yrc: '',
        ttml: ''
      }
    }
  } catch (err: any) {
    console.error('[mg.lyric] 通过contentId获取歌词失败:', err)
    // 已带错误码的出站拒绝原样抛出，由客户端按 code 本地化
    if (err?.data?.code) throw err
    throw createError({
      statusCode: err.statusCode || 500,
      message: err.message || '获取歌词失败'
    })
  }
})
