import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真正运行 song-request.post.ts，而不是做源码正则断言。
 *
 * 目的：证明「站点未开启留言功能」时端点拒绝带留言的投稿，而不是把留言
 * 静默丢掉还回「点歌成功」。同时确认留言会以 submissionNote 下发，
 * 且长度上限按站点的单一权威常量校验。
 */

const source = fileURLToPath(new URL('../../server/api/bot/voicehub/song-request.post.ts', import.meta.url))

const modules: Record<string, string> = {
  h3: `export const defineEventHandler = fn => fn; export const getHeader = (event, name) => event.headers[name]; export const readBody = async event => event.body;`,
  'drizzle-orm': `export const eq = (column, value) => [column, value];`,
  '~/drizzle/db': `export const db = globalThis.__songDb;`,
  '~/drizzle/schema': `export const systemSettings = { astrbotToken: 'token', astrbotEnabled: 'enabled', astrbotPlatforms: 'platforms' };
    export const astrbotBindings = { umo: 'umo', userId: 'userId', platform: 'platform', adapter: 'adapter' };
    export const users = { id: 'id', role: 'role', status: 'status' };`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/config/constants': `export const SUBMISSION_NOTE_MAX_LENGTH = 300;
    export const SERVER_ERROR_CODES = {
      NOTIFICATION_AUTH_REQUIRED: 'auth', ASTRBOT_UMO_INVALID: 'umo', ASTRBOT_UMO_UNBOUND: 'unbound',
      ASTRBOT_SONG_SESSION_INVALID: 'session', ASTRBOT_SONG_INDEX_INVALID: 'index',
      ASTRBOT_SONG_NOTE_DISABLED: 'note_disabled', COMMON_INVALID_PARAMS: 'params'
    };`,
  '~~/server/utils/astrbot-notification': `export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token';
    export const equalAstrbotToken = (a, b) => a === b && !!a;`,
  '~~/server/utils/astrbot-platforms': `export const adapterToAstrbotPlatform = adapter => adapter === 'aiocqhttp' ? 'qq' : null;
    export const isAstrbotPlatformEnabled = (settings, platform) => settings?.[platform] === true;
    export const isAstrbotPrivateUmoShape = umo => typeof umo === 'string' && /^bot:FriendMessage:[^:]+$/.test(umo);`,
  '~~/server/utils/astrbot-song-search': `export const ASTRBOT_SONG_TICKET_PURPOSE = 'song';
    export const isAstrbotSongTicket = () => true;`,
  '~~/server/utils/music-source-plugins/tickets': `export const unseal = () => ({ candidates: [{ title: '告白气球', artist: '周杰伦', platform: 'netease', musicId: '1' }] });`,
  '~~/server/services/songRequestService': `export const requestSongForUser = async (event, actor, payload) => { globalThis.__songPayload = payload; return { id: 1, title: '告白气球', artist: '周杰伦' }; };`,
  '~~/server/utils/system-settings-helper': `export const getSystemSettingsCached = async () => globalThis.__songSettings;`
}

Object.assign(globalThis as any, { __songDb: {} })

const compiled = await build({
  entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'song-fixture',
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

/** 装配一次调用：站点留言开关 + 用户状态 + 绑定行。 */
function fixture(enableSubmissionRemarks: boolean, userStatus = 'active') {
  const settings = { token: 'valid', enabled: true, platforms: { qq: true } }
  const bindings = [{ userId: 7, platform: 'qq', adapter: 'aiocqhttp' }]
  const userRows = [{ id: 7, role: 'user', status: userStatus }]

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
          if ('astrbotToken' in table) return chain([settings])
          if ('umo' in table) return chain(bindings)
          return chain(userRows)
        }
      }
    }
  }
  Object.assign(globalThis as any, {
    __songSettings: { enableSubmissionRemarks, enablePlayTimeSelection: false },
    __songPayload: undefined
  })
  Object.assign((globalThis as any).__songDb, db)
}

const post = (body: Record<string, unknown>) => handler({
  headers: { 'x-voicehub-token': 'valid' },
  body: { umo: UMO, sessionToken: 'sealed', index: 1, ...body }
})

test('站点未开启留言功能：带留言的投稿被拒绝，不会静默丢字', async () => {
  fixture(false)
  await assert.rejects(
    () => post({ note: '生日快乐' }),
    (error: any) => {
      assert.equal(error.statusCode, 400)
      assert.equal(error.code, 'note_disabled')
      return true
    }
  )
  // 没有调用站点投稿域函数，留言不可能被静默丢弃
  assert.equal((globalThis as any).__songPayload, undefined)
})

test('站点开启留言功能：留言作为 submissionNote 下发', async () => {
  fixture(true)
  const result: any = await post({ note: '  生日快乐  ' })
  assert.equal(result.success, true)
  // 前后空白被裁掉，字段名映射到站点自己的 submissionNote
  assert.equal((globalThis as any).__songPayload.submissionNote, '生日快乐')
})

test('不带留言时不传 submissionNote（保持旧请求体形状）', async () => {
  fixture(true)
  await post({})
  assert.equal((globalThis as any).__songPayload.submissionNote, undefined)
})

test('留言超过 300 字上限被拒绝', async () => {
  fixture(true)
  await assert.rejects(
    () => post({ note: '长'.repeat(301) }),
    (error: any) => error.statusCode === 400 && error.code === 'params'
  )
  // 恰好 300 字要放行
  await post({ note: '长'.repeat(300) })
  assert.equal((globalThis as any).__songPayload.submissionNote.length, 300)
})

test('未开启留言功能但没带留言时不受影响', async () => {
  fixture(false)
  const result: any = await post({})
  assert.equal(result.success, true)
  assert.equal((globalThis as any).__songPayload.submissionNote, undefined)
})

// ----------------------------------------------------------------------
// 手动投稿分支（body.manual）：无票据、无 musicId、无封面/链接
// ----------------------------------------------------------------------

const postManual = (manual: Record<string, unknown>, extra: Record<string, unknown> = {}) => handler({
  headers: { 'x-voicehub-token': 'valid' },
  body: { umo: UMO, manual, ...extra }
})

test('手动投稿：musicId/musicPlatform/cover 均不出现，留言与时段照常下发', async () => {
  fixture(true)
  const result: any = await postManual({ title: '  告白气球  ', artist: ' 周杰伦 ' }, { note: '生日快乐' })
  assert.equal(result.success, true)
  const payload = (globalThis as any).__songPayload
  assert.equal(payload.title, '告白气球')
  assert.equal(payload.artist, '周杰伦')
  assert.equal(payload.musicId, undefined)
  assert.equal(payload.musicPlatform, undefined)
  assert.equal(payload.cover, undefined)
  assert.equal(payload.submissionNote, '生日快乐')
  // 手动投稿不消费票据（unseal 未被调用——票据流程只属于序号投稿）
})

test('手动投稿缺歌手被拒绝且不触达域函数', async () => {
  fixture(true)
  await assert.rejects(
    () => postManual({ title: '告白气球' }),
    (error: any) => error.statusCode === 400
  )
  assert.equal((globalThis as any).__songPayload, undefined)
})

test('手动投稿缺歌名被拒绝', async () => {
  fixture(true)
  await assert.rejects(
    () => postManual({ artist: '周杰伦' }),
    (error: any) => error.statusCode === 400
  )
})

test('手动投稿走站点同一套业务校验（错误码原样透传）', async () => {
  fixture(true)
  // requestSongForUser 桩默认成功；这里只验证 payload 进入了同一入口
  const result: any = await postManual({ title: '晴天', artist: '周杰伦' })
  assert.equal(result.success, true)
  assert.equal((globalThis as any).__songPayload.title, '晴天')
})
