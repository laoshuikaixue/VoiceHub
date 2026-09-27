import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../../server/api/bot/voicehub/verify-targets.post.ts', import.meta.url))
const modules: Record<string, string> = {
  h3: `export const defineEventHandler = fn => fn; export const getHeader = (event, name) => event.headers[name]; export const readBody = async event => event.body;`,
  'drizzle-orm': `export const inArray = (column, values) => [column, values]; export const eq = (column, value) => [column, value];`,
  '~/drizzle/db': `export const db = globalThis.__verifyDb;`,
  '~/drizzle/schema': `export const systemSettings = { astrbotToken: 'token', astrbotEnabled: 'enabled', astrbotBroadcastEnabled: 'broadcastEnabled', astrbotPlatforms: 'platforms', astrbotGroupTargets: 'groups' }; export const astrbotBindings = { umo: 'umo', platform: 'platform', adapter: 'adapter', userId: 'userId' }; export const notificationSettings = { userId: 'notificationUserId', enabled: 'notificationEnabled' };`,
  '~~/server/utils/astrbot-platforms': `export const adapterToAstrbotPlatform = adapter => adapter === 'aiocqhttp' ? 'qq' : null; export const isAstrbotPlatformEnabled = (settings, platform) => settings?.[platform] === true;`,
  '~~/server/utils/astrbot-group': `export const isAstrbotGroupUmoShape = umo => typeof umo === 'string' && /^bot:GroupMessage:[^:]+$/.test(umo); export const isAstrbotGroupTargetAllowed = (targets, platforms, umo) => targets.some(target => target.umo === umo && platforms[target.platform] === true);`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES = { NOTIFICATION_AUTH_REQUIRED: 'auth', ASTRBOT_UMO_INVALID: 'umo' };`,
  '~~/server/utils/astrbot-notification': `export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token'; export const equalAstrbotToken = (a, b) => a === b && !!a; export const isAstrbotPrivateUmoShape = umo => typeof umo === 'string' && /^bot:FriendMessage:[^:]+$/.test(umo);`
}
Object.assign(globalThis, { __verifyDb: {} })
const compiled = await build({ entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'verify-fixture', setup(b) {
    b.onResolve({ filter: /^(h3|drizzle-orm|~\/drizzle\/|~~\/server\/)/ }, args => ({ path: args.path, namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
  } }] })
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
const group = 'bot:GroupMessage:1'
const privateUmo = 'bot:FriendMessage:2'
function fixture(broadcastEnabled: boolean, notificationEnabled: boolean | null = true) {
  const settings = { token: 'valid', enabled: true, groupBroadcastEnabled: broadcastEnabled,
    platforms: { qq: true }, groupTargets: [{ umo: group, platform: 'qq' }] }
  const bindings = [{ umo: privateUmo, platform: 'qq', adapter: 'aiocqhttp', userId: 2, enabled: notificationEnabled }]
  const db = { select(fields: Record<string, string>) {
    return { from(table: Record<string, string>) {
      const isSettings = 'astrbotToken' in table
      let joined = false
      const chain: any = { limit() { return Promise.resolve([settings]) }, where() { return chain },
        leftJoin() { joined = true; return chain },
        then(resolve: (rows: unknown) => void) { resolve(isSettings ? [settings] : bindings.map(row =>
          Object.fromEntries(Object.entries(fields).map(([key, column]) => [key,
            column === 'notificationEnabled' && joined ? row.enabled : (row as any)[column]])))) } }
      return chain
    } }
  } }
  Object.assign((globalThis as any).__verifyDb, db)
}
const event = (umos: string[]) => ({ headers: { 'x-voicehub-token': 'valid' }, body: { umos } })

test('群广播关闭拒绝群目标但仍允许已绑定的私聊目标', async () => {
  fixture(false)
  await assert.rejects(() => handler(event([group])), (error: any) => error.statusCode === 403)
  assert.deepEqual(await handler(event([privateUmo])), { success: true, umos: [privateUmo] })
})

test('用户关闭通知后，私聊目标授权回查拒绝在途消息', async () => {
  fixture(true, false)
  await assert.rejects(() => handler(event([privateUmo])), (error: any) => error.statusCode === 403)
  await assert.rejects(() => handler(event([privateUmo, group])), (error: any) => error.statusCode === 403)
})

test('没有个人设置行时沿用通知默认开启', async () => {
  fixture(true, null)
  assert.deepEqual(await handler(event([privateUmo])), { success: true, umos: [privateUmo] })
})
