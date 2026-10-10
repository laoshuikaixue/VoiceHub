import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真正运行 song-resolve.post.ts：证明链接解析端点
 * - 令牌/绑定校验与搜索端点同口径（401/403）；
 * - 网易云分享文本解析出单曲并密封同形票据（sessionToken + 单条 items）；
 * - 未知域名 400；无法识别歌曲时兜底搜索；空结果 404。
 */

const source = fileURLToPath(new URL('../../server/api/bot/voicehub/song-resolve.post.ts', import.meta.url))

const rawNeteaseDetail = {
  songs: [{
    id: 186016,
    name: '晴天',
    ar: [{ name: '周杰伦' }],
    al: { name: '叶惠美', id: 18879, picUrl: 'https://p.example.com/cover.jpg' },
    dt: 269000
  }]
}

let detailCalls: string[] = []
let searchCalls: { platform: string; keyword: string }[] = []
let searchResults: unknown[] = []

// bundle 内的 fixture 模块引用这些变量：统一走 globalThis 让内外共享
Object.assign(globalThis as any, { detailCalls, searchCalls, searchResults })
function syncGlobals() {
  const g = globalThis as any
  g.detailCalls = detailCalls
  g.searchCalls = searchCalls
  g.searchResults = searchResults
}

const modules: Record<string, string> = {
  h3: `export const defineEventHandler = fn => fn; export const getHeader = (event, name) => event.headers[name]; export const readBody = async event => event.body;`,
  'drizzle-orm': `export const eq = (column, value) => [column, value];`,
  '~/drizzle/db': `export const db = globalThis.__resolveDb;`,
  '~/drizzle/schema': `export const systemSettings = { astrbotToken: 'token', astrbotEnabled: 'enabled', astrbotPlatforms: 'platforms' };
    export const astrbotBindings = { umo: 'umo', userId: 'userId', platform: 'platform', adapter: 'adapter' };`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES = {
    NOTIFICATION_AUTH_REQUIRED: 'auth', ASTRBOT_UMO_INVALID: 'umo', ASTRBOT_UMO_UNBOUND: 'unbound',
    ASTRBOT_SONG_KEYWORD_INVALID: 'keyword', ASTRBOT_SONG_PLATFORM_INVALID: 'platform', ASTRBOT_SONG_INDEX_INVALID: 'index'
  };`,
  '~~/server/utils/serverTime': `export const getServerTimestamp = () => 1700000000000;`,
  '~~/server/utils/astrbot-notification': `export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token';
    export const equalAstrbotToken = (a, b) => a === b && !!a;`,
  '~~/server/utils/astrbot-platforms': `export const adapterToAstrbotPlatform = adapter => adapter === 'aiocqhttp' ? 'qq' : null;
    export const isAstrbotPlatformEnabled = (settings, platform) => settings?.[platform] === true;
    export const isAstrbotPrivateUmoShape = umo => typeof umo === 'string' && /^bot:FriendMessage:[^:]+$/.test(umo);`,
  '~~/server/utils/astrbot-song-search': `
    export const ASTRBOT_SONG_TICKET_PURPOSE = 'song';
    export const ASTRBOT_SONG_TICKET_TTL_MS = 600000;
    export const ASTRBOT_SONG_CANDIDATE_LIMIT = 5;
    export function normalizeAstrbotSongCandidates(platform, list) {
      if (!Array.isArray(list)) return [];
      if (platform === 'bilibili') {
        return list.filter(item => item && item.id && item.title).map(item => ({
          platform, musicId: String(item.id), title: item.title, artist: item.artist || '未知艺术家',
          cover: item.cover || null, durationSeconds: item.duration ? Math.round(item.duration) : null
        }));
      }
      return list.filter(item => item && item.songmid != null && item.name).map(item => ({
        platform, musicId: String(item.songmid), title: item.name, artist: item.singer || '未知艺术家',
        cover: item.img || null, durationSeconds: item.duration ? Math.round(item.duration) : null
      }));
    }
    export async function searchSongs(platform, keyword) {
      searchCalls.push({ platform, keyword });
      return searchResults;
    }`,
  '~~/server/utils/astrbot-share-link': `void 0;`,
  '~~/server/utils/music-source-plugins/tickets': `export const seal = value => 'sealed:' + JSON.stringify(value).length;`,
  '~~/server/utils/music-source-plugins/resolver': `export const enabledCatalog = async catalog => globalThis.__enabledCatalogs.includes(catalog);`,
  '~~/server/utils/native_wy': `export const wyEapiRequest = async (url, data) => {
    detailCalls.push(url + ':' + data.ids);
    if (globalThis.__wyDetailThrows) throw new Error('upstream boom');
    return globalThis.__wyDetail;
  };`,
  '~~/server/utils/native_tx': `export const createTxSongDetailBody = () => ({}); export const normalizeTxMusicId = id => ({ normalizedMusicId: id, idType: 'mid' }); export const txRequest = async () => ({}); export const TX_MUSICU_URL = '';`,
  '~~/server/utils/native_bilibili': `export const biConvertSong = info => ({ id: info.bvid, title: info.title, artist: info.author, cover: info.pic, duration: 0 });`
}

// astrbot-share-link 用真实现（测试其真实解析逻辑通过端点生效）
const shareLinkSource = await (await import('node:fs/promises')).readFile(
  fileURLToPath(new URL('../../server/utils/astrbot-share-link.ts', import.meta.url)), 'utf8'
)
modules['~~/server/utils/astrbot-share-link'] = shareLinkSource

Object.assign(globalThis as any, {
  __resolveDb: {},
  __wyDetail: { code: 200, songs: rawNeteaseDetail.songs },
  __wyDetailThrows: false,
  __enabledCatalogs: ['netease', 'tencent', 'bilibili', 'migu']
})

const compiled = await build({
  entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'resolve-fixture',
    setup(b) {
      b.onResolve({ filter: /^(h3|drizzle-orm|~\/drizzle\/|~~\/server\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'ts' }))
    }
  }]
})
const { default: handler } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

const UMO = 'bot:FriendMessage:2'

/** 装配一次调用。settings 令牌恒为 valid；header 由 headerToken 控制。 */
function fixture(headerToken = 'valid', enabled = true, bound = true, enabledCatalogs: string[] = ['netease', 'tencent', 'bilibili', 'migu']) {
  const settings = { token: 'valid', enabled, platforms: { qq: true } }
  const bindings = bound ? [{ userId: 7, platform: 'qq', adapter: 'aiocqhttp' }] : []
  const chain = (rows: unknown[]) => ({
    limit: () => Promise.resolve(rows),
    where: () => chain(rows),
    then: (resolve: (rows: unknown) => void) => resolve(rows)
  })
  const db = {
    select() {
      return {
        from(table: Record<string, string>) {
          if ('astrbotToken' in table) return chain([settings])
          return chain(bindings)
        }
      }
    }
  }
  const target = globalThis as any
  // 原地刷新 db 属性：bundle 已捕获 globalThis.__resolveDb 引用，不能整体重新赋值
  Object.assign(target.__resolveDb, db)
  Object.assign(target, { __enabledCatalogs: enabledCatalogs })
  return { headers: { 'x-voicehub-token': headerToken }, body: {} as any } as any
}

function resetUpstream() {
  detailCalls = []
  searchCalls = []
  searchResults = []
  syncGlobals()
  ;(globalThis as any).__wyDetail = { code: 200, songs: rawNeteaseDetail.songs }
  ;(globalThis as any).__wyDetailThrows = false
}

test('网易云分享文本 → 单曲候选 + 同形票据', async () => {
  resetUpstream()
  const event = fixture()
  event.body = { umo: UMO, text: '分享《晴天》 https://music.163.com/song?id=186016&userid=1 快听' }
  const result = await handler(event)
  assert.equal(result.success, true)
  assert.equal(result.platform, 'netease')
  assert.equal(result.count, 1)
  assert.deepEqual(result.items, [{ index: 1, title: '晴天', artist: '周杰伦', durationSeconds: 269 }])
  assert.match(result.sessionToken, /^sealed:/)
  assert.match(detailCalls[0], /186016/)
  assert.equal(searchCalls.length, 0)
})

test('未知域名 400', async () => {
  resetUpstream()
  const event = fixture()
  event.body = { umo: UMO, text: 'https://example.com/song?id=1' }
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 400)
    return true
  })
})

test('无链接纯文本 400', async () => {
  resetUpstream()
  const event = fixture()
  event.body = { umo: UMO, text: '晴天' }
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 400)
    return true
  })
})

test('详情接口拿不到时兜底按文本关键词搜索', async () => {
  resetUpstream()
  ;(globalThis as any).__wyDetail = { code: 200, songs: [] }
  searchResults = [{
    platform: 'netease', musicId: '999', title: '晴天（兜底）', artist: '周杰伦',
    cover: null, durationSeconds: 269
  }]
  syncGlobals()
  const event = fixture()
  event.body = { umo: UMO, text: '分享《晴天》 https://music.163.com/song?id=186016 快听' }
  const result = await handler(event)
  assert.equal(result.items[0].title, '晴天（兜底）')
  assert.deepEqual(searchCalls, [{ platform: 'netease', keyword: '分享《晴天》  快听' }])
})

test('兜底搜索也为空时 404', async () => {
  resetUpstream()
  ;(globalThis as any).__wyDetail = { code: 200, songs: [] }
  searchResults = []
  syncGlobals()
  const event = fixture()
  event.body = { umo: UMO, text: '分享《晴天》 https://music.163.com/song?id=186016 快听' }
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 404)
    return true
  })
})

test('令牌错误 401、未绑定 403', async () => {
  resetUpstream()
  const bad = fixture('wrong')
  bad.body = { umo: UMO, text: 'https://music.163.com/song?id=186016' }
  await assert.rejects(() => handler(bad), (error: any) => error.statusCode === 401)

  const unbound = fixture('valid', true, false)
  unbound.body = { umo: UMO, text: 'https://music.163.com/song?id=186016' }
  await assert.rejects(() => handler(unbound), (error: any) => error.statusCode === 403)
})

test('分享内容为空或超长 400', async () => {
  resetUpstream()
  const empty = fixture()
  empty.body = { umo: UMO, text: '' }
  await assert.rejects(() => handler(empty), (error: any) => error.statusCode === 400)

  const long = fixture()
  long.body = { umo: UMO, text: 'x'.repeat(501) }
  await assert.rejects(() => handler(long), (error: any) => error.statusCode === 400)
})

// ----------------------------------------------------------------------
// 短链跟随与降级：163cn.tv / b23.tv / 上游失败 / SSRF 防护
// ----------------------------------------------------------------------

test('163cn.tv 短链先跟随跳转再解析 song?id', async () => {
  resetUpstream()
  const fetchCalls: { url: string; redirect?: string }[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: any, options: any) => {
    fetchCalls.push({ url: String(url), redirect: options?.redirect })
    return new Response(null, {
      status: 302,
      headers: { location: 'https://music.163.com/song?id=186016' }
    })
  }) as typeof fetch
  try {
    const event = fixture()
    event.body = { umo: UMO, text: '分享单曲《晴天》 http://163cn.tv/abcdef (@网易云音乐)' }
    const result = await handler(event)
    assert.equal(result.platform, 'netease')
    assert.equal(result.items[0].title, '晴天')
    assert.equal(fetchCalls.length, 1)
    assert.equal(fetchCalls[0].url, 'http://163cn.tv/abcdef')
    // 必须手动逐跳跟随（redirect: manual），禁止自动 follow
    assert.equal(fetchCalls[0].redirect, 'manual')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('b23.tv 短链跟随到 BV 号后解析 B站单曲', async () => {
  resetUpstream()
  const originalFetch = globalThis.fetch
  const originalDollarFetch = (globalThis as any).$fetch
  globalThis.fetch = (async () => new Response(null, {
    status: 302,
    headers: { location: 'https://www.bilibili.com/video/BV1xx411c7mD' }
  })) as typeof fetch
  ;(globalThis as any).$fetch = async () => ({
    data: {
      aid: 1, bvid: 'BV1xx411c7mD', title: '晴天 MV', owner: { name: 'UP主' },
      pic: 'https://p.example.com/b.jpg', duration: 269, pages: []
    }
  })
  try {
    const event = fixture()
    event.body = { umo: UMO, text: '【晴天MV】 https://b23.tv/abc123' }
    const result = await handler(event)
    assert.equal(result.platform, 'bilibili')
    assert.equal(result.items[0].title, '晴天 MV')
  } finally {
    globalThis.fetch = originalFetch
    ;(globalThis as any).$fetch = originalDollarFetch
  }
})

test('路径伪造短链的内网地址不会被请求（400 且零网络调用）', async () => {
  resetUpstream()
  const fetchCalls: string[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: any) => {
    fetchCalls.push(String(url))
    throw new Error('不应发起网络请求')
  }) as typeof fetch
  try {
    const event = fixture()
    event.body = { umo: UMO, text: 'http://10.0.0.1:8080//b23.tv/abc123' }
    await assert.rejects(() => handler(event), (error: any) => {
      assert.equal(error.statusCode, 400)
      return true
    })
    assert.equal(fetchCalls.length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('详情上游抛错时降级为关键词兜底搜索，而不是 500', async () => {
  resetUpstream()
  ;(globalThis as any).__wyDetailThrows = true
  searchResults = [{
    platform: 'netease', musicId: '999', title: '晴天（兜底）', artist: '周杰伦',
    cover: null, durationSeconds: 269
  }]
  syncGlobals()
  const event = fixture()
  event.body = { umo: UMO, text: '分享《晴天》 https://music.163.com/song?id=186016 快听' }
  const result = await handler(event)
  assert.equal(result.items[0].title, '晴天（兜底）')
  assert.equal(searchCalls.length, 1)
})

test('站点停用平台后，其分享链接被拒绝（400 且零上游请求）', async () => {
  resetUpstream()
  const event = fixture('valid', true, true, ['tencent', 'bilibili', 'migu'])
  event.body = { umo: UMO, text: '分享《晴天》 https://music.163.com/song?id=186016 快听' }
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 400)
    return true
  })
  assert.equal(detailCalls.length, 0)
  assert.equal(searchCalls.length, 0)
})
