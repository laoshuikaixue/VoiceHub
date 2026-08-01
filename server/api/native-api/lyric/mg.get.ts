// 咪咕 mrc 逐字歌词解密（TEA 算法）
const DELTA = 2654435769n
const MIN_LENGTH = 32
const keyArr = [
  27303562373562475n,
  18014862372307051n,
  22799692160172081n,
  34058940340699235n,
  30962724186095721n,
  27303523720101991n,
  27303523720101998n,
  31244139033526382n,
  28992395054481524n
]

const toLong = (value: bigint | string): bigint => {
  const num = typeof value === 'string' ? BigInt('0x' + value) : value
  const MAX = 9223372036854775807n
  const MIN = -9223372036854775808n
  if (num > MAX) return toLong(num - (1n << 64n))
  if (num < MIN) return toLong(num + (1n << 64n))
  return num
}

const longToBytes = (l: bigint): Buffer => {
  const result = Buffer.alloc(8)
  for (let i = 0; i < 8; i++) {
    result[i] = parseInt((l & 0xffn).toString())
    l >>= 8n
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
  let j3 = toLong((6n + 52n / lengthBigint) * DELTA)
  while (true) {
    const j4 = j3
    if (j4 === 0n) break
    const j5 = toLong(3n & (j4 >> 2n))
    let j6 = lengthBigint
    while (true) {
      j6--
      if (j6 > 0n) {
        const j7 = data[Number(j6 - 1n)]!
        const i = Number(j6)
        j2 = toLong(
          data[i]! -
            (toLong(toLong(j2 ^ j4) + toLong(j7 ^ key[Number(toLong((3n & j6) ^ j5))]!)) ^
              toLong(
                toLong(toLong(j7 >> 5n) ^ toLong(j2 << 2n)) +
                  toLong(toLong(j2 >> 3n) ^ toLong(j7 << 4n))
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
          toLong(toLong(key[Number(toLong((j6 & 3n) ^ j5))]! ^ j8) + toLong(j2 ^ j4)) ^
            toLong(
              toLong(toLong(j8 >> 5n) ^ toLong(j2 << 2n)) +
                toLong(toLong(j2 >> 3n) ^ toLong(j8 << 4n))
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

const MIGU_LYRIC_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36',
  Referer: 'https://app.c.nf.migu.cn/',
  channel: '0146921'
}

const fetchLyricText = async (url: string) => {
  const response = await fetch(url, {
    headers: MIGU_LYRIC_HEADERS,
    signal: AbortSignal.timeout(8000)
  })
  if (!response.ok) {
    throw createError({ statusCode: 502, message: `咪咕歌词接口返回 ${response.status}` })
  }
  return response.text()
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const lrcUrl = query.lrcUrl as string
  const contentId = query.contentId as string
  const mrcUrl = query.mrcUrl as string

  // 优先使用 mrc 逐字歌词（解密后解析）
  if (mrcUrl) {
    try {
      const mrcText = await fetchLyricText(mrcUrl)
      const lrc = parseMrcToLrc(decryptMrc(mrcText))
      if (!lrc || !lrc.trim()) {
        throw createError({ statusCode: 404, message: '歌词内容为空' })
      }
      return {
        success: true,
        data: { lrc, trans: '', yrc: '', ttml: '' }
      }
    } catch (err: any) {
      console.error('[mg.lyric] 获取 mrc 歌词失败:', err)
      throw createError({
        statusCode: err.statusCode || 500,
        message: err.message || '获取歌词失败'
      })
    }
  }

  // 优先使用歌词URL
  if (lrcUrl) {
    try {
      const lrcText = await fetchLyricText(lrcUrl)

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
      console.error('[mg.lyric] 获取歌词失败:', err)
      throw createError({
        statusCode: err.statusCode || 500,
        message: err.message || '获取歌词失败'
      })
    }
  }

  // 如果没有提供歌词URL，通过contentId查询歌曲信息获取歌词URL
  if (contentId) {
    try {
      // 通过歌曲信息接口获取 lrcUrl/mrcUrl
      const songInfoResponse: any = await $fetch(
        `https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=${contentId}`,
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
      throw createError({
        statusCode: err.statusCode || 500,
        message: err.message || '获取歌词失败'
      })
    }
  }

  // 既没有歌词URL也没有contentId
  throw createError({
    statusCode: 400,
    message: '缺少 lrcUrl、mrcUrl 或 contentId 参数'
  })
})
