import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'
import { networkUrl } from '../../server/utils/music-source-plugins/network.ts'

// 匿名取链限流边界：只约束未登录请求，且不改变前端登录态复验判定
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const RESOLVE_URL = read('../../server/api/music/resolve-url.post.ts')
const MUSIC_URL = read('../../app/utils/musicUrl.ts')
const LIMITER = read('../../server/utils/music-resolve-rate-limit.ts')
const NETEASE_URL = read('../../server/api/native-api/wy/url.post.ts')

test('限流仅作用于匿名请求且在解析工作之前', () => {
  assert.match(LIMITER, /const ANONYMOUS_RESOLVE_LIMIT = 10/)
  assert.match(LIMITER, /const ANONYMOUS_RESOLVE_WINDOW_MS = 60 \* 1000/)
  for (const source of [RESOLVE_URL, NETEASE_URL]) {
    const handlerHead = source.match(/export default defineEventHandler[\s\S]*?const body = await readBody/)?.[0]
    assert.ok(handlerHead)
    assert.match(handlerHead, /await enforceAnonymousMusicResolveRateLimit\(event\)/)
  }
  assert.match(LIMITER, /music_resolve_url_ip:\$\{getClientIP\(event\)\}/)
})

test('超限返回可本地化的 429', () => {
  assert.match(LIMITER, /429/)
  assert.match(LIMITER, /SERVER_ERROR_CODES\.AUTH_RATE_LIMITED_SECONDS/)
  assert.match(LIMITER, /\{ params: \[waitSeconds\] \}/)
})

test('被限流不得清除本地 QQ 登录态', () => {
  // 条件随实现改为「有登录态即尝试官方」，429 仍不得触发登录态复验/清理
  const branch = MUSIC_URL.match(/if \(qqMusicCookie && !excludedSources\.has\('qq-official'\)[\s\S]*?\n {4}\}/)?.[0] ?? ''
  assert.ok(branch, '未找到官方链路降级分支')
  assert.match(branch, /status !== 429/)
  assert.match(branch, /await revalidateQqLoginAfterFailure\(\)/)
})

const codes = new Proxy({}, { get: (_target, key) => key })
const createApiError = (statusCode, code, message, data = {}) => Object.assign(new Error(message), {
  statusCode, data: { code, ...data }
})
const compile = (source: string, globals: Record<string, unknown>, result: string) => {
  const code = stripTypeScriptTypes(source.replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?$/gm, ''))
    .replace('export default ', 'return ').replace(/^export /gm, '')
  return new Function(...Object.keys(globals), code + result)(...Object.values(globals))
}

function fixture() {
  const state = { requests: [], reads: 0, counts: new Map<string, number>(),
    response: { status: 200, bytes: Buffer.from(JSON.stringify({ code: 200, url: 'https://music.163.com/audio.mp3' })) } }
  const enforce = compile(LIMITER, {
    createApiError, SERVER_ERROR_CODES: codes, getClientIP: (event) => event.ip,
    getServerTimestamp: () => 1000,
    checkDistributedRateLimit: async (key, limit, windowMs) => {
      assert.equal(windowMs, 60000)
      const count = (state.counts.get(key) || 0) + 1
      state.counts.set(key, count)
      return { isAllowed: count <= limit, resetTime: 61000 }
    }
  }, '\nreturn enforceAnonymousMusicResolveRateLimit')
  const route = compile(NETEASE_URL, {
    createApiError, SERVER_ERROR_CODES: codes, networkUrl,
    enforceAnonymousMusicResolveRateLimit: enforce,
    defineEventHandler: (handler) => handler,
    readBody: async (event) => { state.reads++; return event.body },
    requestNetwork: async (...args) => { state.requests.push(args); return state.response }
  }, '')
  const event = { context: {} as Record<string, unknown>, ip: '192.0.2.1', body: { musicId: '123', level: 'exhigh' } }
  return { state, enforce, route, event }
}

test('网易云代理与现有限流器共享额度，超限不读取正文或访问上游', async () => {
  const { state, enforce, route, event } = fixture()
  for (let i = 0; i < 10; i++) await enforce(event)
  await assert.rejects(route(event), (error) => error.statusCode === 429 && error.data.params[0] === 60)
  assert.equal(state.reads, 0)
  assert.equal(state.requests.length, 0)
  await route({ ...event, ip: '192.0.2.2' })
  assert.equal(state.requests.length, 1)
})

test('登录请求不计入匿名额度，失效登录态仍受限', async () => {
  const { state, enforce, event } = fixture()
  await enforce({ ...event, context: { user: { id: 1 } } })
  assert.equal(state.counts.size, 0)
  await enforce({ ...event, context: { authRejected: true } })
  assert.equal(state.counts.size, 1)
})

test('网易云代理拒绝非法 ID，音质映射不读取原型属性', async () => {
  const { route, state, event } = fixture()
  event.context.user = { id: 1 }
  for (const musicId of [null, {}, [], '0', '-1', '1.5', '1e3', '9'.repeat(21), Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(route({ ...event, body: { musicId } }), (error) => error.statusCode === 400)
  }
  assert.equal(state.requests.length, 0)
  for (const [level, quality] of [['lossless', 'flac'], ['toString', '320k'], ['__proto__', '320k']]) {
    await route({ ...event, body: { musicId: 123, level } })
    const [, options, limit] = state.requests.at(-1)
    assert.deepEqual(JSON.parse(options.body), { source: 'wy', musicId: '123', quality })
    assert.equal(limit, 64 * 1024)
  }
})

test('网易云代理统一处理上游异常状态、非法 JSON 与不安全播放地址', async () => {
  const { route, state, event } = fixture()
  event.context.user = { id: 1 }
  for (const response of [
    { status: 403, bytes: Buffer.from('{"code":200,"url":"https://music.163.com/x"}') },
    { status: 200, bytes: Buffer.from('not json') },
    ...['http://127.0.0.1/private', 'javascript:alert(1)', 'https://user:pass@music.163.com/x'].map((url) => ({
      status: 200, bytes: Buffer.from(JSON.stringify({ code: 200, url, message: '上游内部错误' }))
    }))
  ]) {
    state.response = response
    await assert.rejects(route(event), (error) => error.statusCode === 502 && error.data.code === 'MUSIC_URL_RESOLVE_FAILED')
  }
})
