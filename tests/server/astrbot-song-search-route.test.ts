import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真正运行 song-search.post.ts：证明搜索端点的音源选择与站点配置同口径。
 * - 缺省音源 = platformOrder 排序后第一个启用音源（跳过停用）；
 * - 显式传入的平台仍校验合法性与启用状态；
 * - 全部停用且缺省时明确 400，而不是落到已停用的固定默认值。
 */

const source = fileURLToPath(new URL('../../server/api/bot/voicehub/song-search.post.ts', import.meta.url))

const modules: Record<string, string> = {
  h3: `export const defineEventHandler = fn => fn; export const getHeader = (event, name) => event.headers[name]; export const readBody = async event => event.body;`,
  'drizzle-orm': `export const eq = (column, value) => [column, value];`,
  '~/drizzle/db': `export const db = globalThis.__searchDb;`,
  '~/drizzle/schema': `export const systemSettings = { astrbotToken: 'token', astrbotEnabled: 'enabled', astrbotPlatforms: 'platforms', platformOrder: 'platformOrder' };
    export const astrbotBindings = { umo: 'umo', userId: 'userId', platform: 'platform', adapter: 'adapter' };`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES = {
    NOTIFICATION_AUTH_REQUIRED: 'auth', ASTRBOT_UMO_INVALID: 'umo', ASTRBOT_UMO_UNBOUND: 'unbound',
    ASTRBOT_SONG_KEYWORD_INVALID: 'keyword', ASTRBOT_SONG_PLATFORM_INVALID: 'platform'
  };`,
  '~~/server/utils/serverTime': `export const getServerTimestamp = () => 1700000000000;`,
  '~~/server/utils/astrbot-notification': `export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token';
    export const equalAstrbotToken = (a, b) => a === b && !!a;`,
  '~~/server/utils/astrbot-platforms': `export const adapterToAstrbotPlatform = adapter => adapter === 'aiocqhttp' ? 'qq' : null;
    export const isAstrbotPlatformEnabled = (settings, platform) => settings?.[platform] === true;
    export const isAstrbotPrivateUmoShape = umo => typeof umo === 'string' && /^bot:FriendMessage:[^:]+$/.test(umo);`,
  '~~/server/utils/astrbot-song-search': `export const ASTRBOT_SONG_CANDIDATE_LIMIT = 5;
    export const ASTRBOT_SONG_KEYWORD_MAX_LENGTH = 100;
    export const ASTRBOT_SONG_TICKET_PURPOSE = 'song';
    export const ASTRBOT_SONG_TICKET_TTL_MS = 600000;
    export const parseAstrbotSongSource = value =>
      (typeof value === 'string' && ['netease', 'tencent', 'bilibili', 'migu'].includes(value)) ? value : null;
    export const parseAstrbotPlatformOrder = value => {
      const sources = ['netease', 'tencent', 'bilibili', 'migu'];
      let parsed;
      try { parsed = JSON.parse(typeof value === 'string' ? value : '[]'); } catch { parsed = null; }
      const valid = (Array.isArray(parsed) ? parsed : []).filter(p => sources.includes(p));
      if (valid.length === 0) return [...sources];
      const merged = [...valid];
      for (const p of sources) if (!merged.includes(p)) merged.push(p);
      return merged;
    };
    export const searchSongs = async (platform, keyword, page) => {
      globalThis.__searchCalls.push({ platform, keyword, page });
      return globalThis.__searchCandidates;
    };`,
  '~~/server/utils/music-source-plugins/tickets': `export const seal = value => 'sealed:' + JSON.stringify(value).length;`,
  '~~/server/utils/music-source-plugins/resolver': `export const enabledCatalog = async catalog => globalThis.__enabledSet.includes(catalog);`
}

Object.assign(globalThis as any, {
  __searchDb: {},
  __searchCalls: [],
  __searchCandidates: [],
  __enabledSet: []
})

const compiled = await build({
  entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'search-fixture',
    setup(b) {
      b.onResolve({ filter: /^(h3|drizzle-orm|~\/drizzle\/|~~\/server\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    }
  }]
})
const { default: handler } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

const UMO = 'bot:FriendMessage:2'

/** 装配一次调用：启用目录 / platformOrder / platform 参数由用例控制。 */
function fixture({ enabledSet, platformOrder, platform, keyword = '告白气球' }: {
  enabledSet: string[]
  platformOrder?: unknown
  platform?: unknown
  keyword?: string
}) {
  const settings = [{ token: 'valid', enabled: true, platforms: { qq: true }, platformOrder }]
  const bindings = [{ userId: 7, platform: 'qq', adapter: 'aiocqhttp' }]
  const chain = (rows: unknown[]) => {
    const c: any = {
      limit: () => Promise.resolve(rows),
      where: () => c,
      then: (resolve: (rows: unknown) => void) => resolve(rows)
    }
    return c
  }
  const db = {
    select() {
      return {
        from(table: Record<string, string>) {
          if ('astrbotToken' in table) return chain(settings)
          return chain(bindings)
        }
      }
    }
  }
  const target = globalThis as any
  Object.assign(target.__searchDb, db)
  Object.assign(target, {
    __searchCalls: [],
    __enabledSet: enabledSet,
    __searchCandidates: [{
      platform: 'netease', musicId: '1', title: '告白气球', artist: '周杰伦', cover: null, durationSeconds: 215
    }]
  })
  const body: Record<string, unknown> = { umo: UMO, keyword }
  if (platform !== undefined) body.platform = platform
  return { headers: { 'x-voicehub-token': 'valid' }, body } as any
}

test('缺省音源 = 站点排序后第一个启用音源（跳过停用）', async () => {
  const event = fixture({
    enabledSet: ['bilibili', 'tencent'],
    platformOrder: JSON.stringify(['netease', 'bilibili', 'tencent', 'migu'])
  })
  const result: any = await handler(event)
  assert.equal(result.success, true)
  assert.equal(result.platform, 'bilibili')
  assert.deepEqual((globalThis as any).__searchCalls, [{ platform: 'bilibili', keyword: '告白气球', page: 1 }])

  // platformOrder 缺失时回退白名单顺序，仍跳过停用项
  const fallback = fixture({ enabledSet: ['tencent'] })
  const result2: any = await handler(fallback)
  assert.equal(result2.platform, 'tencent')
})

test('显式传入 platform 时按传入值搜索', async () => {
  const event = fixture({ enabledSet: ['netease', 'tencent'], platform: 'tencent' })
  const result: any = await handler(event)
  assert.equal(result.platform, 'tencent')
  assert.deepEqual((globalThis as any).__searchCalls, [{ platform: 'tencent', keyword: '告白气球', page: 1 }])
})

test('显式传入非法 platform 拒绝（400）且不发起搜索', async () => {
  const event = fixture({ enabledSet: ['netease'], platform: 'qq' })
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 400)
    assert.equal(error.message, '不支持的音源平台')
    return true
  })
  assert.equal((globalThis as any).__searchCalls.length, 0)
})

test('显式传入被停用平台拒绝（400）且不发起搜索', async () => {
  const event = fixture({ enabledSet: ['bilibili'], platform: 'netease' })
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 400)
    assert.equal(error.message, '该音源已被站点停用')
    return true
  })
  assert.equal((globalThis as any).__searchCalls.length, 0)
})

test('缺省且全部音源停用时拒绝（400）', async () => {
  const event = fixture({
    enabledSet: [],
    platformOrder: JSON.stringify(['netease', 'tencent', 'bilibili', 'migu'])
  })
  await assert.rejects(() => handler(event), (error: any) => {
    assert.equal(error.statusCode, 400)
    assert.equal(error.message, '站点当前未启用任何音源')
    return true
  })
  assert.equal((globalThis as any).__searchCalls.length, 0)
})
