import { Buffer } from 'buffer'
import axios from 'axios'
import * as cheerio from 'cheerio/slim'
import CryptoJS from 'crypto-js'
import dayjs from 'dayjs'
import bigInteger from 'big-integer'
import qs from 'qs'
import he from 'he'
import GuestURL from 'core-js-pure/features/url/index.js'
import GuestURLSearchParams from 'core-js-pure/features/url-search-params/index.js'

const sync = (method, data) => JSON.parse(globalThis.__hostSync(method, JSON.stringify(data)))
const asyncCall = async (method, data) => JSON.parse(await globalThis.__hostAsync(method, JSON.stringify(data)))
const bytes = (value) => Array.from(typeof value === 'string' ? Buffer.from(value) : Buffer.from(value || []))
globalThis.Buffer = Buffer
globalThis.URL = GuestURL
globalThis.URLSearchParams = GuestURLSearchParams
globalThis.window = globalThis
globalThis.self = globalThis
globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64')
globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')
globalThis.TextEncoder = class { encode(value) { return Uint8Array.from(Buffer.from(value, 'utf8')) } }
globalThis.TextDecoder = class { decode(value) { return Buffer.from(value).toString('utf8') } }
globalThis.crypto = { getRandomValues(value) { value.set(sync('random', value.length)); return value } }

let sequence = 0
const timers = new Map()
globalThis.setTimeout = (fn, delay = 0, ...args) => {
  const id = ++sequence
  timers.set(id, true)
  asyncCall('sleep', Math.max(0, Number(delay) || 0)).then(() => {
    if (timers.delete(id)) fn(...args)
  }).catch(() => timers.delete(id))
  return id
}
globalThis.clearTimeout = (id) => timers.delete(id)
globalThis.console = Object.fromEntries(['log', 'info', 'warn', 'error', 'debug', 'group', 'groupEnd', 'groupCollapsed', 'table', 'time', 'timeEnd', 'trace', 'assert', 'clear'].map((name) => [name, (...args) => sync('log', args.map(String).join(' ').slice(0, 2000))]))

const http = async (url, config = {}, requestId = ++sequence) => {
  let body = config.body
  const headers = { ...(config.headers || {}) }
  if (config.form) {
    body = qs.stringify(config.form)
    headers['content-type'] ||= 'application/x-www-form-urlencoded'
  } else if (config.formData) {
    const boundary = `voicehub-${++sequence}`
    body = Object.entries(config.formData).map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key.replace(/[\r\n"]/g, '')}"\r\n\r\n${String(value)}\r\n`).join('') + `--${boundary}--\r\n`
    headers['content-type'] = `multipart/form-data; boundary=${boundary}`
  } else if (body && typeof body === 'object' && !ArrayBuffer.isView(body)) {
    body = JSON.stringify(body)
    headers['content-type'] ||= 'application/json'
  }
  const cancel = () => sync('abort', requestId)
  config.signal?.addEventListener('abort', cancel, { once: true })
  let result
  try {
    result = await asyncCall('http', { id: requestId, url, method: config.method, timeout: config.timeout, headers, body: body === undefined ? undefined : bytes(body) })
  } finally { config.signal?.removeEventListener('abort', cancel) }
  result.raw = Buffer.from(result.bytes)
  const text = result.raw.toString('utf8')
  try { result.body = JSON.parse(text) } catch { result.body = text }
  return result
}

axios.defaults.adapter = async (config) => {
  const url = axios.getUri(config)
  if (config.signal?.aborted) throw new axios.CanceledError()
  const result = await http(url, { ...config, body: config.data, headers: config.headers?.toJSON?.() || config.headers })
  const response = { status: result.status, statusText: '', headers: result.headers, config, data: config.responseType === 'arraybuffer' ? result.raw.buffer.slice(result.raw.byteOffset, result.raw.byteOffset + result.raw.byteLength) : result.raw.toString('utf8') }
  if (config.validateStatus && !config.validateStatus(result.status)) throw new axios.AxiosError('HTTP request failed', 'ERR_BAD_RESPONSE', config, null, response)
  return response
}
const modules = { axios, cheerio, 'crypto-js': CryptoJS, dayjs, 'big-integer': bigInteger, qs, he }
globalThis.require = (name) => {
  const value = modules[name]
  if (!value) throw new Error(`Unsupported module: ${name}`)
  if (!value.default && Object.isExtensible(value)) value.default = value
  return value
}
globalThis.__musicfree_require = globalThis.require
globalThis.module = { exports: {} }
globalThis.exports = globalThis.module.exports
globalThis.env = { os: 'linux', appVersion: '1.6.0', lang: 'zh-CN', getUserVariables: () => globalThis.__variables || {} }
Object.defineProperty(globalThis.env, 'userVariables', { get: () => globalThis.env.getUserVariables() })

let lxHandler
let lxSources
let readyResolve
const ready = new Promise((resolve) => { readyResolve = resolve })
const lx = {
  EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
  version: '2.0.0', env: 'desktop',
  currentScriptInfo: {},
  on(event, handler) {
    if (event !== 'request' || typeof handler !== 'function') return Promise.reject(new Error('Unsupported event'))
    lxHandler = handler
    return Promise.resolve()
  },
  send(event, data) {
    if (event === 'inited') {
      if (lxSources) return Promise.reject(new Error('Already initialized'))
      lxSources = data.sources || {}
      readyResolve()
    } else if (event !== 'updateAlert') return Promise.reject(new Error('Unsupported event'))
    return Promise.resolve()
  },
  request(url, options, callback) {
    let aborted = false
    const id = ++sequence
    http(url, options, id).then((result) => {
      if (!aborted) callback(null, { statusCode: result.status, headers: result.headers, raw: result.raw, bytes: result.raw.length, body: result.body }, result.body)
    }).catch((error) => { if (!aborted) callback(error, null, null) })
    return () => { aborted = true; sync('abort', id) }
  },
  utils: {
    buffer: { from: (...args) => Buffer.from(...args), bufToString: (value, encoding = 'utf8') => Buffer.from(value).toString(encoding) },
    crypto: {
      md5: (value) => sync('md5', bytes(value)),
      randomBytes: (size) => Buffer.from(sync('random', size)),
      aesEncrypt: (data, mode, key, iv) => Buffer.from(sync('aes', [bytes(data), mode, bytes(key), iv ? bytes(iv) : null])),
      rsaEncrypt: (data, key) => Buffer.from(sync('rsa', [bytes(data), key]))
    },
    zlib: {
      inflate: async (data) => Buffer.from(await asyncCall('inflate', bytes(data))),
      deflate: async (data) => Buffer.from(await asyncCall('deflate', bytes(data)))
    }
  }
}
globalThis.lx = lx
let plugin
let protocol
globalThis.__inspect = async (requested) => {
  plugin = globalThis.module.exports.default || globalThis.module.exports
  protocol = requested === 'auto' ? (typeof plugin?.getMediaSource === 'function' || typeof plugin?.search === 'function' ? 'musicfree' : 'lx') : requested
  if (protocol === 'lx') {
    await ready
    if (typeof lxHandler !== 'function') throw new Error('Missing request handler')
    return { protocol, name: lx.currentScriptInfo.name, sources: Object.fromEntries(Object.entries(lxSources).map(([key, cap]) => [key, { actions: cap.actions || [], qualities: cap.qualitys || cap.qualities || [] }])), search: false, lyric: false, variables: [] }
  }
  if (!plugin || (typeof plugin.getMediaSource !== 'function' && typeof plugin.search !== 'function')) throw new Error('Invalid MusicFree plugin')
  return { protocol, name: plugin.platform || '', sources: { musicfree: { actions: typeof plugin.getMediaSource === 'function' ? ['musicUrl'] : [], qualities: ['standard', 'high', 'super', 'lossless'] } }, search: typeof plugin.search === 'function', lyric: typeof plugin.getLyric === 'function', variables: Array.isArray(plugin.userVariables) ? plugin.userVariables : [] }
}
globalThis.__invoke = async (action, params) => {
  if (protocol === 'lx') return lxHandler({ source: params.source, action, info: { type: params.quality, musicInfo: params.item } })
  if (action === 'search') return plugin.search(params.query, params.page, 'music')
  if (action === 'lyric') return plugin.getLyric?.(params.item)
  return plugin.getMediaSource(params.item, params.quality)
}
