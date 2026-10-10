import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真正运行 song-sources.get.ts，而不是只做源码正则断言。
 *
 * 目的：证明音源列表按传入的启用目录（enabledCatalog）过滤，序号从 1
 * 连续编号，且未配置令牌时端点拒绝。序号语义 = 站点音源启用列表顺序。
 */

const source = fileURLToPath(new URL('../../server/api/bot/voicehub/song-sources.get.ts', import.meta.url))

const modules: Record<string, string> = {
  h3: `export const defineEventHandler = fn => fn; export const getHeader = (event, name) => event.headers[name];`,
  '~/drizzle/db': `export const db = globalThis.__sourcesDb;`,
  '~/drizzle/schema': `export const systemSettings = { astrbotToken: 'token', astrbotEnabled: 'enabled', platformOrder: 'platformOrder' };`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES = { NOTIFICATION_AUTH_REQUIRED: 'auth' };`,
  '~~/server/utils/astrbot-notification': `export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token';
    export const equalAstrbotToken = (a, b) => a === b && !!a;`,
  '~~/server/utils/astrbot-song-search': `export const ASTRBOT_SONG_SOURCES = ['netease', 'tencent', 'bilibili', 'migu'];
    export const DEFAULT_ASTRBOT_SONG_SOURCE = 'netease';`,
  '~~/server/utils/music-source-plugins/resolver': `export const enabledCatalog = async catalog => globalThis.__enabledSet.includes(catalog);`
}

const compiled = await build({
  entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'sources-fixture',
    setup(b) {
      b.onResolve({ filter: /^(h3|~\/drizzle\/|~~\/server\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    }
  }]
})

// bundle 在 import 时捕获 db 引用：fixture 必须替换同一引用的属性，而非重新赋值
Object.assign(globalThis as any, { __sourcesDb: { select: () => ({ from: () => [] }) }, __enabledSet: [] as string[] })

const { default: handler } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

/** 装配一次调用：站点令牌开关 + 启用目录 + platformOrder。settings 令牌恒为 valid，header 由参数控制。 */
function fixture(enabledSet: string[], headerToken = 'valid', enabled = true, platformOrder?: unknown) {
  const settings = [{ token: 'valid', enabled, platformOrder }]
  const chain = (rows: unknown[]) => ({
    limit: () => Promise.resolve(rows),
    where: () => chain(rows),
    then: (resolve: (rows: unknown) => void) => resolve(rows)
  })
  const db = {
    select() {
      return { from: () => chain(settings) }
    }
  }
  const target = globalThis as any
  // 原地刷新 db 属性：bundle 已捕获 globalThis.__sourcesDb 引用，不能整体重新赋值
  Object.assign(target.__sourcesDb, db)
  Object.assign(target, { __enabledSet: enabledSet })
  return { headers: { 'x-voicehub-token': headerToken } } as any
}

test('音源列表按启用目录过滤并从 1 连续编号', async () => {
  const event = fixture(['netease', 'bilibili'])
  const body = await handler(event)
  assert.equal(body.success, true)
  assert.deepEqual(body.sources, [
    { index: 1, key: 'netease', name: '网易云音乐' },
    { index: 2, key: 'bilibili', name: '哔哩哔哩' }
  ])
  assert.equal(body.defaultSource, 'netease')
})

test('音源顺序跟随站点 platformOrder，defaultSource 取第一个启用音源', async () => {
  const event = fixture(['netease', 'bilibili'], 'valid', true, JSON.stringify(['bilibili', 'netease', 'migu', 'tencent']))
  const body = await handler(event)
  assert.deepEqual(body.sources, [
    { index: 1, key: 'bilibili', name: '哔哩哔哩' },
    { index: 2, key: 'netease', name: '网易云音乐' }
  ])
  assert.equal(body.defaultSource, 'bilibili')
})

test('platformOrder 为非法 JSON 时回退默认顺序', async () => {
  const event = fixture(['netease', 'migu'], 'valid', true, 'not-json')
  const body = await handler(event)
  assert.deepEqual(body.sources, [
    { index: 1, key: 'netease', name: '网易云音乐' },
    { index: 2, key: 'migu', name: '咪咕音乐' }
  ])
  assert.equal(body.defaultSource, 'netease')
})

test('全部音源停用时返回空列表，defaultSource 为 null', async () => {
  const event = fixture([])
  const body = await handler(event)
  assert.equal(body.success, true)
  assert.deepEqual(body.sources, [])
  assert.equal(body.defaultSource, null)
})

test('令牌错误时端点拒绝（401）', async () => {
  const event = fixture(['netease'], 'wrong-token')
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 401)
    return true
  })
})

test('站点机器人总开关关闭时端点拒绝（401）', async () => {
  const event = fixture(['netease'], 'valid', false)
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 401)
    return true
  })
})
