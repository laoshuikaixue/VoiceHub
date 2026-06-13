import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const neteaseEnhancedApiPromise = import('@neteasecloudmusicapienhanced/api').then((mod) => {
  return (mod.default || {}) as Record<string, (params: Record<string, any>) => Promise<any>>
})

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
    throw createError({
      statusCode: error?.statusCode || error?.status || 500,
      message: error?.body?.message || error?.message || '网易云接口调用失败',
      data: error?.body || null
    })
  }
})
