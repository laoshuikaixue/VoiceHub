import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const neteaseEnhancedApiPromise = import('@neteasecloudmusicapienhanced/api').then((mod) => {
  return (mod.default || {}) as Record<string, (params: Record<string, any>) => Promise<any>>
})

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

  const queryParams = normalizeParams(getQuery(event))
  let bodyParams: Record<string, any> = {}

  if (method !== 'GET') {
    const body = await readBody(event).catch(() => ({}))
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      bodyParams = normalizeParams(body as Record<string, any>)
    }
  }

  const params = { ...queryParams, ...bodyParams }

  // 等待 xeapi 公钥等配置就绪
  await ensureNcmConfig()

  try {
    const result = await handler(params)
    if (Array.isArray(result?.cookie) && result.cookie.length > 0) {
      setHeader(event, 'set-cookie', result.cookie)
    }
    if (typeof result?.status === 'number') {
      setResponseStatus(event, result.status)
    }
    return result?.body ?? result
  } catch (error: any) {
    // 上游模块以 { status, body: { code, msg } } 形态抛出失败，真实原因在 body.msg
    const upstream = error?.body ?? null
    const upstreamMessage = upstream?.msg || upstream?.message || error?.message
    console.warn(`[Netease] ${endpointPath} 调用失败: ${error?.status || 500} ${upstreamMessage}`)
    throw createError({
      statusCode: error?.statusCode || error?.status || 500,
      message: upstreamMessage || '网易云接口调用失败',
      data: { endpoint: endpointPath, upstream }
    })
  }
})
