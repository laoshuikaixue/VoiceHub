import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { getServerTimestamp } from '~~/server/utils/serverTime'

// --- 加密逻辑 ---
const eapiKey = 'e82ckenh8dichen8'

const aesEncrypt = (buffer: Buffer, mode: string, key: string | Buffer, iv: string | Buffer) => {
  const cipher = createCipheriv(mode, key, iv)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

export const eapi = (url: string, object: any) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : object
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = createHash('md5').update(message).digest('hex')
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`

  return {
    params: aesEncrypt(Buffer.from(data), 'aes-128-ecb', eapiKey, '').toString('hex').toUpperCase()
  }
}

// --- 请求逻辑 ---

/** eapi 加密接口专用域名，与普通 api 域名分开以降低风控命中 */
const EAPI_DOMAIN = 'https://interfacepc.music.163.com'
/** 专用域名不可用时的兼容域名 */
const EAPI_FALLBACK_DOMAIN = 'https://interface.music.163.com'
const EAPI_TIMEOUT = 8000
const EAPI_MAX_ATTEMPTS = 3
const EAPI_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'

// 进程级设备指纹：只生成一次，避免每次请求都被识别为新设备
const NTES_NUID = randomBytes(16).toString('hex')
const NTES_NNID = `${NTES_NUID},${getServerTimestamp()}`
const DEVICE_ID = randomBytes(26).toString('hex').toUpperCase()
const WNMCID = (() => {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let suffix = ''
  for (let i = 0; i < 6; i += 1) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${suffix}.${getServerTimestamp()}.01.0`
})()

/** 服务端仅在未携带 NMTID 的 eapi 请求上下发 Set-Cookie: NMTID=...，取得后缓存复用 */
let cachedNmtid = ''
/** NMTID 探测次数上限，用尽后回退随机值，避免持续走探测分支 */
let nmtidProbeLeft = 3

/** 组装 eapi 客户端必备 Cookie；未取到 NMTID 时不带该字段，交给服务端下发 */
const buildEapiCookie = () => {
  const fields: Record<string, string> = {
    __remember_me: 'true',
    ntes_kaola_ad: '1',
    _ntes_nuid: NTES_NUID,
    _ntes_nnid: NTES_NNID,
    WNMCID,
    WEVNSM: '1.0.0',
    osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
    deviceId: DEVICE_ID,
    os: 'pc',
    channel: 'netease',
    appver: '3.1.29.205117'
  }

  if (cachedNmtid) {
    fields.NMTID = cachedNmtid
  } else if (nmtidProbeLeft <= 0) {
    fields.NMTID = `00O${randomBytes(19).toString('hex').slice(0, 38)}`
  }

  return Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

/** 从响应头提取服务端下发的 NMTID 并缓存，供后续请求复用 */
const captureNmtid = (setCookie: string | null) => {
  if (!setCookie || cachedNmtid || nmtidProbeLeft <= 0) return

  const matched = setCookie.match(/(?:^|[;,\s])NMTID=([^;,\s]+)/)
  if (!matched) return

  nmtidProbeLeft -= 1
  cachedNmtid = matched[1]
}

/** 单次 eapi 请求；网络异常按次数退避重试 */
const postEapi = async (domain: string, form: { params: string }, maxAttempts: number) => {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${domain}/eapi/batch`, {
        method: 'POST',
        headers: {
          'User-Agent': EAPI_USER_AGENT,
          origin: 'https://music.163.com',
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: buildEapiCookie()
        },
        body: new URLSearchParams(form).toString(),
        signal: AbortSignal.timeout(EAPI_TIMEOUT)
      })

      captureNmtid(response.headers.get('set-cookie'))

      if (!response.ok) {
        throw new Error(`网易云 eapi 接口返回 ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 200))
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  const causeCode = (lastError as { cause?: { code?: string } })?.cause?.code
  throw new Error(causeCode ? `${message} (${causeCode})` : message)
}

export const wyEapiRequest = async (url: string, data: any) => {
  const form = eapi(url, data)

  try {
    return await postEapi(EAPI_DOMAIN, form, EAPI_MAX_ATTEMPTS)
  } catch (error: any) {
    console.warn('[native_wy] eapi 专用域名请求失败，回退兼容域名:', error?.message || error)
    // 专用域名整体不可用时只做一次兜底尝试，避免拖长搜索耗时
    return await postEapi(EAPI_FALLBACK_DOMAIN, form, 1)
  }
}
