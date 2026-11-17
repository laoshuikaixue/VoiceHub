import { existsSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  isNeteaseRealIpEnabled,
  resolveNeteaseRealIp
} from '~~/server/utils/neteaseRealIp'

const neteaseEnhancedApiPromise = import('@neteasecloudmusicapienhanced/api').then((mod) => {
  return (mod.default || {}) as Record<string, (params: Record<string, any>) => Promise<any>>
})

// 上游 SDK 自身不设超时，一次挂起会长期占住云函数实例（Pages 上会放大成整站 504），故加整体截止时间
const NETEASE_CALL_TIMEOUT_MS = 12000
// xeapi 公钥预热同样可能挂起，且模块级 promise 被所有请求共用，必须单独封顶
const NETEASE_CONFIG_TIMEOUT_MS = 5000
// 整体截止时间到期的机器可读标记，用于识别此类预期失败
const NETEASE_UPSTREAM_TIMEOUT_CODE = 'NETEASE_UPSTREAM_TIMEOUT'

async function withDeadline<T>(task: Promise<T>, ms: number, endpoint: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(createError({
          statusCode: 504,
          statusMessage: NETEASE_UPSTREAM_TIMEOUT_CODE,
          message: `网易云接口 ${endpoint} 调用超时`
        })), ms)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// 网易云接口白名单：只放行应用实际调用的端点（端点路径 → 允许的 HTTP 方法）
// 未列入的接口一律 403；新增或变更调用端点时必须同步此表（见 AGENTS.md 4.9）
const allowedEndpoints = new Map<string, Set<string>>([
  // 搜索 / 详情 / 封面 / 歌词 / 播放链接
  ['cloudsearch', new Set(['GET'])],
  ['search', new Set(['GET'])],
  ['song/detail', new Set(['GET'])],
  ['song/url/v1', new Set(['GET'])],
  ['album', new Set(['GET'])],
  ['lyric', new Set(['GET'])],
  ['lyric/new', new Set(['GET'])],
  // 播客节目列表
  ['dj/program', new Set(['GET'])],
  // 听歌识曲（音频指纹走请求体，仅 POST）
  ['audio/match', new Set(['POST'])],
  // 评论
  ['comment/music', new Set(['GET'])],
  ['comment/like', new Set(['GET'])],
  // 扫码登录
  ['login/qr/key', new Set(['GET'])],
  ['login/qr/create', new Set(['GET'])],
  ['login/qr/check', new Set(['GET'])],
  ['login/status', new Set(['GET', 'POST'])],
  // 账号歌单
  ['user/playlist', new Set(['GET'])],
  ['playlist/create', new Set(['GET'])],
  ['playlist/delete', new Set(['GET'])],
  ['playlist/tracks', new Set(['GET'])],
  ['playlist/detail', new Set(['GET'])],
  ['playlist/track/all', new Set(['GET'])],
  // 播放记录 / 听歌上报
  ['record/recent/song', new Set(['GET'])],
  ['scrobble/v1', new Set(['GET'])],
  // 云盘上传（文件本体由客户端直传，仅令牌与完成回调经服务端）
  ['cloud/upload/token', new Set(['POST'])],
  ['cloud/upload/complete', new Set(['POST'])]
])

// xeapi 公钥缓存文件路径（由 generateConfig 写入系统临时目录）
const xeapiPublicKeyPath = join(tmpdir(), 'xeapi_public_key')

// 扫码登录结果暂存（unikey → cookie），用于 803 响应丢失后的补发
const QR_LOGIN_TTL_MS = 5 * 60 * 1000
const qrLoginCache = new Map<string, { cookie: string; at: number }>()

const rememberQrLogin = (key: string, cookie: string) => {
  // 过期条目交给分钟级定时任务处理。到上限时按插入顺序淘汰最旧的一条，
  // 不能整体 clear，否则会误删其他访客仍在有效期内的 803 结果。
  if (qrLoginCache.size >= 500) {
    const oldest = qrLoginCache.keys().next()
    if (!oldest.done) qrLoginCache.delete(oldest.value)
  }
  qrLoginCache.set(key, { cookie, at: Date.now() })
}

const replayQrLogin = (key: string): string | undefined => {
  const hit = qrLoginCache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > QR_LOGIN_TTL_MS) {
    qrLoginCache.delete(key)
    return undefined
  }
  // 不在命中时删除：前端重试与轮询可能并发，先到的 803 删掉缓存后，
  // 后到的 800 会把成功状态覆盖成「已过期」。缓存由 TTL 统一回收。
  return hit.cookie
}

// 低流量下 size 阈值兜不住过期条目，按分钟兜底清理；unref 避免阻止进程退出
setInterval(() => {
  const cutoff = Date.now() - QR_LOGIN_TTL_MS
  for (const [k, v] of qrLoginCache) {
    if (v.at < cutoff) qrLoginCache.delete(k)
  }
}, 60 * 1000).unref()

let ncmConfigReady = false
let ncmConfigPromise: Promise<void> | null = null

const ensureNcmConfig = (): Promise<void> => {
  if (ncmConfigReady) return Promise.resolve()
  if (!ncmConfigPromise) {
    ncmConfigPromise = import('@neteasecloudmusicapienhanced/api/generateConfig.js')
      .then((mod) => (mod.default || mod)())
      .then(() => {
        if (existsSync(xeapiPublicKeyPath)) {
          ncmConfigReady = true
          console.log('[Netease] xeapi 公钥初始化完成')
        } else {
          console.error('[Netease] xeapi 公钥生成失败，下次请求将重试')
        }
      })
      .catch((error: unknown) => {
        console.error('[Netease] xeapi 配置初始化失败:', error)
      })
      .finally(() => {
        ncmConfigPromise = null
      })
  }
  return ncmConfigPromise
}

// 预热配置，不阻塞启动
ensureNcmConfig()

const normalizeParams = (input: Record<string, any>) => {
  const output: Record<string, any> = {}
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    output[key] = Array.isArray(value) ? value[value.length - 1] : value
  }
  return output
}

/**
 * 出口 IP 的稳定种子：
 * - 扫码流程用访客 IP（不能用 unikey：key 阶段还没有 unikey，会与 create/check 落到不同出口 IP）；
 * - 账号相关请求用 MUSIC_U，保证同一账号的地区不来回跳；
 * - 其余请求（搜索、歌曲地址等）每次随机，不携带任何账号特征。
 */
const buildRealIpSeed = (
  endpointPath: string,
  clientIp: string,
  cookieText: string
): string | undefined => {
  if (endpointPath.startsWith('login/qr/')) {
    // 关键：qr/key 生成 unikey 时还不知道 unikey 本身。若按 unikey 取种子，
    // key 走默认、create/check 走带 unikey 的种子，三步落在不同出口 IP，
    // 网易云会判定该二维码异地校验，扫码确认后直接返回 800（失效）而不是 803。
    // 改用访客 IP 做种子：同一人三步必然同 IP，不同人天然隔离。
    return clientIp ? `qr:${clientIp}` : 'qr:default'
  }

  const matched = cookieText.match(/(?:^|;\s*)MUSIC_U=([^;]+)/)
  return matched?.[1] ? `account:${matched[1]}` : undefined
}

/** cookie 可能按数组重复传参（cookie=a&cookie=b），合并全部片段再解析，避免漏掉 MUSIC_U */
const collectCookieText = (input: unknown): string => {
  if (!input || typeof input !== 'object') return ''
  const raw = (input as Record<string, unknown>).cookie
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string').join('; ')
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const rawPath = getRouterParam(event, 'path')
  const endpointPath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath
  const method = getMethod(event)

  if (!endpointPath) {
    throw createError({
      statusCode: 400,
      message: '缺少网易云接口路径'
    })
  }

  if (!/^[a-z0-9/-]+$/i.test(endpointPath)) {
    throw createError({
      statusCode: 400,
      message: '网易云接口路径不合法'
    })
  }

  const allowedMethods = allowedEndpoints.get(endpointPath)
  if (!allowedMethods || !allowedMethods.has(method)) {
    console.warn(`[Netease] 拦截未放行的接口: ${method} ${endpointPath}`)
    throw createError({
      statusCode: 403,
      message: `禁止访问接口: ${endpointPath}`
    })
  }

  const action = endpointPath.replace(/\//g, '_').replace(/-/g, '_')
  const api = await neteaseEnhancedApiPromise
  const handler = api[action]

  if (typeof handler !== 'function') {
    throw createError({
      statusCode: 404,
      message: `未找到接口: ${endpointPath}`
    })
  }

  const rawQuery = getQuery(event)
  const queryParams = normalizeParams(rawQuery)
  let bodyParams: Record<string, any> = {}
  let rawBody: Record<string, any> = {}

  if (method !== 'GET') {
    const body = await readBody(event).catch(() => ({}))
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      rawBody = body as Record<string, any>
      bodyParams = normalizeParams(rawBody)
    }
  }

  const params = { ...queryParams, ...bodyParams }
  const cookieText = Array.from(
    new Set([collectCookieText(rawQuery), collectCookieText(rawBody)].filter(Boolean))
  ).join('; ')
  // 扫码链路的出口种子取访客 IP。直接读请求头而不走 h3 自动导入，便于单测加载本模块。
  // 前置代理会覆盖转发头，且客户端伪造的 IP 仅用于挑选出口 IP，不参与鉴权。
  const reqHeaders = event.node?.req?.headers
  const rawClientIp = reqHeaders?.['x-real-ip'] ?? reqHeaders?.['x-forwarded-for'] ?? ''
  const candidateIp = String(Array.isArray(rawClientIp) ? rawClientIp[0] : rawClientIp)
    .split(',')[0]!
    .trim()
  // 只接受合法 IP 字面量（IPv4/IPv6），非法值退回默认种子，避免任意头值进入种子。
  // IPv6 访客同样按自身地址取种子，三步仍然一致，不会退化成全员共用 qr:default。
  const clientIp = isIP(candidateIp) ? candidateIp.toLowerCase() : ''

  // 境外出口会被网易云判为海外，登录与账号接口直接失败；统一改写 X-Real-IP。
  // 客户端传入的 realIP 一律忽略，避免该代理变成任意 IP 伪造入口。
  if (isNeteaseRealIpEnabled()) {
    params.realIP = resolveNeteaseRealIp(buildRealIpSeed(endpointPath, clientIp, cookieText))
    if (process.env.NETEASE_REAL_IP_DEBUG === 'true') {
      console.log(`[Netease] ${endpointPath} 出口 IP: ${params.realIP}`)
    }
  }

  // 等待 xeapi 公钥等配置就绪：超时或失败都继续，让上游错误以有界的失败返回，而不是无限等待
  await withDeadline(ensureNcmConfig(), NETEASE_CONFIG_TIMEOUT_MS, 'generateConfig').catch((error: unknown) => {
    console.warn(`[Netease] xeapi 配置初始化超时: ${error instanceof Error ? error.message : String(error)}`)
  })

  try {
    const result = await withDeadline(handler(params), NETEASE_CALL_TIMEOUT_MS, endpointPath)
    if (Array.isArray(result?.cookie) && result.cookie.length > 0) {
      setHeader(event, 'set-cookie', result.cookie)
    }
    if (typeof result?.status === 'number') {
      setResponseStatus(event, result.status)
    }
    const body = result?.body ?? result
    // 扫码结果补发：803 只在网易云侧出现一次，前端那次响应若被网关打断（502/504），
    // cookie 就永久丢失，用户看到的是「手机确认成功却没登上」。按 unikey 暂存后回放。
    if (endpointPath === 'login/qr/check') {
      const qrKey = typeof params.key === 'string' ? params.key : ''
      const code = Number(body?.code)
      const cookie = typeof body?.cookie === 'string' ? body.cookie : ''
      if (qrKey && code === 803 && cookie) {
        rememberQrLogin(qrKey, cookie)
      } else if (qrKey && code !== 803) {
        const replayed = replayQrLogin(qrKey)
        if (replayed) {
          // 只回干净结构，避免把上游的「二维码已过期」等文案一起带给前端
          return { code: 803, message: '登录成功', cookie: replayed }
        }
      }
    }
    return body
  } catch (error: any) {
    // 上游模块以 { status, body: { code, msg } } 形态抛出失败，真实原因在 body.msg
    const upstream = error?.body ?? null
    const upstreamMessage = upstream?.msg || upstream?.message || error?.message
    console.warn(`[Netease] ${endpointPath} 调用失败: ${error?.status || 500} ${upstreamMessage}`)
    const wrapped = createError({
      statusCode: error?.statusCode || error?.status || 500,
      message: upstreamMessage || '网易云接口调用失败',
      data: { endpoint: endpointPath, upstream }
    })
    // 截止时间到期的标记需要透传，否则重包后 Sentry 过滤无法识别
    if (error?.statusMessage === NETEASE_UPSTREAM_TIMEOUT_CODE) {
      wrapped.statusMessage = NETEASE_UPSTREAM_TIMEOUT_CODE
    }
    throw wrapped
  }
})
