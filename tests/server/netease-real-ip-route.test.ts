import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { isChinaIp } from '../../server/utils/neteaseRealIp.ts'

/**
 * 运行真实的网易云代理路由：证明
 * - 扫码/账号请求都注入中国大陆 realIP，客户端传入的 realIP 被忽略；
 * - 同一次扫码的 key/create/check 使用同一出口 IP；
 * - 同一账号（MUSIC_U）使用同一出口 IP；
 * - NETEASE_REAL_IP_MODE=off 时完全不下发 realIP；
 * - 803 响应丢失后可按 unikey 补发结果。
 */

const source = fileURLToPath(new URL('../../server/api/api-enhanced/netease/[...path].ts', import.meta.url))

const modules: Record<string, string> = {
  '@neteasecloudmusicapienhanced/api': `
    const calls = globalThis.__ncmCalls
    export const login_qr_key = params => { calls.push({ endpoint: 'login/qr/key', params }); return { body: { code: 200 } } }
    export const login_qr_create = params => { calls.push({ endpoint: 'login/qr/create', params }); return { body: { code: 200 } } }
    export const login_qr_check = params => { calls.push({ endpoint: 'login/qr/check', params }); return globalThis.__ncmQrCheck || { body: { code: 800 } } }
    export const login_status = params => { calls.push({ endpoint: 'login/status', params }); return { body: { code: 200 } } }
    export default { login_qr_key, login_qr_create, login_qr_check, login_status }
  `,
  '@neteasecloudmusicapienhanced/api/generateConfig.js': `export default async () => {}`
}

Object.assign(globalThis as any, { __ncmCalls: [] })

// Nitro 自动导入的 h3 运行时钩子在这里手工提供
Object.assign(globalThis as any, {
  defineEventHandler: (fn: unknown) => fn,
  getRouterParam: (event: any, name: string) => event.params?.[name],
  getMethod: (event: any) => event.method || 'GET',
  getQuery: (event: any) => event.query || {},
  readBody: async (event: any) => event.body || {},
  setHeader: (event: any, name: string, value: unknown) => {
    ;(event.headers ||= {})[name] = value
  },
  setResponseStatus: (event: any, status: number) => {
    event.status = status
  },
  createError: (options: any) => Object.assign(new Error(options.message), options)
})

const compiled = await build({
  entryPoints: [source],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  // 让测试自包含：不依赖 nuxt prepare 生成的 .nuxt/tsconfig.json 别名映射
  alias: {
    '~~/server/utils/neteaseRealIp': fileURLToPath(
      new URL('../../server/utils/neteaseRealIp.ts', import.meta.url)
    )
  },
  plugins: [{
    name: 'resolve-fixture',
    setup(b) {
      b.onResolve({ filter: /^(h3|@neteasecloudmusicapienhanced\/)/ }, (args) => ({
        path: args.path,
        namespace: 'fixture'
      }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
        contents: modules[args.path] || 'export default {}',
        loader: 'ts'
      }))
    }
  }]
})

const { default: handler } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

function makeEvent(pathname: string, query: Record<string, any> = {}, ip = '113.108.1.10'): any {
  return {
    params: { path: pathname },
    method: 'GET',
    query: { ...query },
    node: { req: { headers: { 'x-real-ip': ip } } }
  }
}

async function call(pathname: string, query: Record<string, any> = {}, ip = '113.108.1.10') {
  await handler(makeEvent(pathname, query, ip))
  const callRecord = (globalThis as any).__ncmCalls.at(-1)
  assert.equal(callRecord.endpoint, pathname)
  return callRecord.params as Record<string, any>
}

/** 需要读取响应体时使用（补发逻辑只体现在返回值上） */
function respond(pathname: string, query: Record<string, any> = {}, ip = '113.108.1.10') {
  return handler(makeEvent(pathname, query, ip))
}

test('扫码登录请求注入中国大陆 realIP', async () => {
  const params = await call('login/qr/key')
  assert.ok(isChinaIp(String(params.realIP)), `realIP=${params.realIP} 不在中国大陆网段`)
})

test('客户端传入的 realIP 被忽略', async () => {
  const params = await call('login/qr/key', { realIP: '1.2.3.4', ip: '5.6.7.8' })
  assert.ok(isChinaIp(String(params.realIP)))
  assert.notEqual(params.realIP, '1.2.3.4')
})

test('同一次扫码的 key / create / check 使用同一出口 IP', async () => {
  const ip = '61.135.1.10'
  const keyed = await call('login/qr/key', {}, ip)
  const created = await call('login/qr/create', { key: 'unikey-1234567890' }, ip)
  const checked = await call('login/qr/check', { key: 'unikey-1234567890' }, ip)
  assert.equal(created.realIP, checked.realIP)
  assert.equal(keyed.realIP, created.realIP)
  assert.ok(isChinaIp(String(created.realIP)))
})

test('不同访客使用不同出口 IP', async () => {
  const first = await call('login/qr/create', { key: 'key-a' }, '113.108.1.10')
  const second = await call('login/qr/create', { key: 'key-a' }, '61.172.2.20')
  assert.notEqual(first.realIP, second.realIP)
})

test('同一访客的 key 传参形式不影响出口 IP', async () => {
  const ip = '113.108.1.10'
  const single = await call('login/qr/create', { key: 'unikey-array' }, ip)
  const created = await call('login/qr/create', { key: ['stale-key', 'unikey-array'] }, ip)
  const checked = await call('login/qr/check', { key: ['stale-key', 'unikey-array'] }, ip)
  assert.equal(created.realIP, single.realIP)
  assert.equal(checked.realIP, single.realIP)
})

test('同一账号的 cookie 请求使用同一 IP', async () => {
  const cookie = 'MUSIC_U=abc123; __csrf=def'
  const first = await call('login/status', { cookie })
  const second = await call('login/status', { cookie })
  assert.equal(first.realIP, second.realIP)
  assert.ok(isChinaIp(String(first.realIP)))
})

test('cookie 以数组重复传参时仍能识别 MUSIC_U', async () => {
  const single = await call('login/status', { cookie: 'MUSIC_U=abc123; __csrf=def' })
  const arrayForm = await call('login/status', { cookie: ['MUSIC_U=abc123', '__csrf=def'] })
  assert.equal(arrayForm.realIP, single.realIP)
})

test('NETEASE_REAL_IP_MODE=off 时不下发 realIP', async () => {
  const original = process.env.NETEASE_REAL_IP_MODE
  process.env.NETEASE_REAL_IP_MODE = 'off'
  try {
    const params = await call('login/qr/key')
    assert.equal(params.realIP, undefined)
  } finally {
    if (original === undefined) delete process.env.NETEASE_REAL_IP_MODE
    else process.env.NETEASE_REAL_IP_MODE = original
  }
})

test('803 响应丢失后，重复查询可补发登录结果', async () => {
  const g = globalThis as any
  g.__ncmQrCheck = { body: { code: 803, cookie: 'MUSIC_U=xyz; __csrf=1' } }
  const success = await respond('login/qr/check', { key: 'replay-key' })
  assert.equal(success.code, 803)

  // 网易云侧 unikey 已消费，后续只返回过期；补发保证前端仍能拿到 cookie
  g.__ncmQrCheck = { body: { code: 800, message: '二维码已过期' } }
  const replay = await respond('login/qr/check', { key: 'replay-key' })
  assert.equal(replay.code, 803)
  assert.equal(replay.cookie, 'MUSIC_U=xyz; __csrf=1')

  // 其它二维码不受影响
  const other = await respond('login/qr/check', { key: 'other-key' })
  assert.equal(other.code, 800)
  delete g.__ncmQrCheck
})

test('并发重试不会因为首次补发而丢失结果', async () => {
  const g = globalThis as any
  g.__ncmQrCheck = { body: { code: 803, cookie: 'MUSIC_U=concurrent' } }
  await respond('login/qr/check', { key: 'concurrent-key' })

  // unikey 已被网易云消费，并发到达的几次查询都要拿到同一份 cookie
  g.__ncmQrCheck = { body: { code: 800 } }
  const results = await Promise.all([
    respond('login/qr/check', { key: 'concurrent-key' }),
    respond('login/qr/check', { key: 'concurrent-key' }),
    respond('login/qr/check', { key: 'concurrent-key' })
  ])
  for (const item of results) {
    assert.equal(item.code, 803)
    assert.equal(item.cookie, 'MUSIC_U=concurrent')
  }
  delete g.__ncmQrCheck
})

test('IPv6 访客按自身地址取种子，三步仍一致', async () => {
  const ip = '240e:3b0:1234::1'
  const keyed = await call('login/qr/key', {}, ip)
  const created = await call('login/qr/create', { key: 'k-ipv6' }, ip)
  assert.equal(keyed.realIP, created.realIP)
  assert.ok(isChinaIp(String(keyed.realIP)))
})

test('畸形 IP 头退回默认种子，不进入哈希', async () => {
  const params = await call('login/qr/key', {}, 'not-an-ip<script>')
  assert.ok(isChinaIp(String(params.realIP)))
})
