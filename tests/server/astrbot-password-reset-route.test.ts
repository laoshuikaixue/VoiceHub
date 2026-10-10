import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真正运行 password-reset.post.ts 的两步确认流程。
 * fixture 桩掉 h3/drizzle/密码链路模块；pending 缓存模块保留真实现。
 * settings 令牌恒为 valid，header 由参数控制（防 401 测试恒过的老坑）。
 */

const source = fileURLToPath(new URL('../../server/api/bot/voicehub/password-reset.post.ts', import.meta.url))

const modules: Record<string, string> = {
  h3: `export const defineEventHandler = fn => fn; export const getHeader = (event, name) => event.headers[name]; export const readBody = async event => event.body;`,
  '~/drizzle/db': `export const db = globalThis.__prDb;`,
  '~/drizzle/schema': `export const systemSettings = { __table: 'settings' }; export const astrbotBindings = { __table: 'bindings' };`,
  '~~/server/utils/apiError': `export const createApiError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });`,
  '~~/server/config/constants': `export const SERVER_ERROR_CODES = { NOTIFICATION_AUTH_REQUIRED: 'auth_required', ASTRBOT_UMO_INVALID: 'umo_invalid', ASTRBOT_UMO_UNBOUND: 'unbound', COMMON_INVALID_PARAMS: 'params', AUTH_RATE_LIMITED_MINUTES: 'rate_limited' };`,
  '~~/server/utils/astrbot-notification': `export const ASTRBOT_TOKEN_HEADER = 'x-voicehub-token';
    export const equalAstrbotToken = (a, b) => a === b && !!a;`,
  '~~/server/utils/ip-utils': `export const getClientIP = event => event.headers['x-forwarded-for'] || '127.0.0.1';`,
  '~~/server/utils/astrbot-platforms': `export const adapterToAstrbotPlatform = adapter => adapter === 'aiocqhttp' ? 'qq' : null;
    export const isAstrbotPlatformEnabled = (settings, platform) => settings?.[platform] === true;
    export const isAstrbotPrivateUmoShape = umo => typeof umo === 'string' && umo.split(':').length === 3 && umo.split(':')[1] === 'FriendMessage';`,
  '~~/server/services/astrbotOutboxService': `export const enqueueAstrbotNotifications = async (userIds, title, content, platform) => {
    globalThis.__prNotifications.push({ userIds, title, content, platform });
    return 1;
  };`,
  '~~/server/services/userService': `export const updateUserPassword = async (userId, newPassword, options) => {
    globalThis.__prUpdates.push({ userId, newPassword, options });
    return { passwordChangedAt: new Date('2026-10-09T00:00:00Z'), tokenVersion: 2 };
  };`,
  '~/utils/password-policy': `export const getPasswordPolicyViolation = password => {
    if (typeof password !== 'string' || password.length < 8) return { code: 'policy', message: '密码太短' };
    return null;
  };`,
  '~~/server/services/passwordSecurityService': `export const PASSWORD_AUDIT_ACTIONS = { RESET_PASSWORD: 'RESET_PASSWORD' };
    export const consumePasswordRateLimit = async (...args) => {
      globalThis.__prRateCalls.push(args);
      return globalThis.__prRateLimited
        ? { allowed: false, retryAfterSeconds: 600 }
        : { allowed: true, retryAfterSeconds: 0 };
    };
    export const getPasswordAuditContext = () => ({});
    export const recordPasswordAudit = async (...args) => { globalThis.__prAudit.push(args); };`
}

const compiled = await build({
  entryPoints: [source], bundle: true, platform: 'node', format: 'esm', write: false,
  // pending 缓存模块是真实现，不桩
  external: ['node:crypto'],
  plugins: [{
    name: 'pr-fixture',
    setup(b) {
      b.onResolve({ filter: /.*/ }, args => {
        // pending 缓存模块是真实现，不桩；node:crypto 走真实模块
        if (args.path.endsWith('astrbot-password-reset') || args.path === 'node:crypto') return null
        if (args.path === 'h3' || args.path.startsWith('~/') || args.path.startsWith('~~/')) {
          return { path: args.path, namespace: 'fixture' }
        }
        return null
      })
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path] ?? '', loader: 'js' }))
    }
  }]
})

Object.assign(globalThis as any, {
  __prDb: {},
  __prNotifications: [],
  __prUpdates: [],
  __prAudit: [],
  __prRateCalls: [],
  __prRateLimited: false
})

const { default: handler } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`
)

const UMO = 'aiocqhttp:FriendMessage:10086'

/** 装配一次调用：settings 令牌恒 valid；binding 与平台开关由参数控制。 */
function fixture({ headerToken = 'valid', binding = { userId: 7, platform: 'qq', adapter: 'aiocqhttp' }, platforms = { qq: true }, ip = '203.0.113.7', body }: {
  headerToken?: string
  binding?: { userId: number; platform: string; adapter: string } | null
  platforms?: Record<string, boolean>
  ip?: string
  body: Record<string, unknown>
}) {
  const settingsRows = [{ token: 'valid', enabled: true, platforms }]
  const bindingRows = binding ? [binding] : []
  const db = {
    select() {
      const state = { table: '' }
      const chain: any = {
        from(table: any) {
          state.table = table?.__table === 'settings' ? 'settings' : 'bindings'
          return chain
        },
        where: () => chain,
        limit: () => chain
      }
      // settings 查询被直接 await（thenable）；binding 查询链上取 rows 属性
      chain.then = (resolve: (rows: unknown[]) => void) => resolve(
        state.table === 'settings' ? settingsRows : bindingRows
      )
      Object.defineProperty(chain, 'rows', { get: () => (state.table === 'settings' ? settingsRows : bindingRows) })
      return chain
    }
  }
  const target = globalThis as any
  // 原地刷新 db 属性：bundle 已捕获 globalThis.__prDb 引用，不能整体重新赋值
  Object.assign(target.__prDb, db)
  return { headers: { 'x-voicehub-token': headerToken, 'x-forwarded-for': ip }, body } as any
}

function reset() {
  const target = globalThis as any
  target.__prNotifications = []
  target.__prUpdates = []
  target.__prAudit = []
  target.__prRateCalls = []
  target.__prRateLimited = false
}

test('init：校验通过后返回 pendingToken（5 分钟）且不改密码', async () => {
  reset()
  const res: any = await handler(fixture({
    body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' }
  }))
  assert.equal(res.success, true)
  assert.equal(res.step, 'init')
  assert.ok(res.pendingToken.length > 8)
  assert.equal(res.expiresInSeconds, 300)
  // 第一步不写密码、不发通知
  assert.equal((globalThis as any).__prUpdates.length, 0)
  assert.equal((globalThis as any).__prNotifications.length, 0)
})

test('confirm：凭 pendingToken 与相同密码完成重置并通知发起渠道', async () => {
  reset()
  const init: any = await handler(fixture({
    body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' }
  }))
  const res: any = await handler(fixture({
    body: { umo: UMO, step: 'confirm', pendingToken: init.pendingToken, password: 'N3w-Passw0rd!' }
  }))
  assert.equal(res.success, true)
  assert.equal(res.step, 'confirm')
  const updates = (globalThis as any).__prUpdates
  assert.equal(updates.length, 1)
  assert.equal(updates[0].userId, 7)
  assert.equal(updates[0].newPassword, 'N3w-Passw0rd!')
  // 通知走发起渠道（qq）
  const notifications = (globalThis as any).__prNotifications
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].platform, 'qq')
  assert.ok(!JSON.stringify(notifications[0]).includes('N3w-Passw0rd!'))
})

test('confirm：pendingToken 一次性——重放被拒绝', async () => {
  reset()
  const init: any = await handler(fixture({
    body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' }
  }))
  const first: any = await handler(fixture({
    body: { umo: UMO, step: 'confirm', pendingToken: init.pendingToken, password: 'N3w-Passw0rd!' }
  }))
  assert.equal(first.success, true)
  await assert.rejects(
    () => handler(fixture({
      body: { umo: UMO, step: 'confirm', pendingToken: init.pendingToken, password: 'N3w-Passw0rd!' }
    })),
    (error: any) => error.statusCode === 400
  )
  assert.equal((globalThis as any).__prUpdates.length, 1)
})

test('confirm：两次密码不一致被拒绝', async () => {
  reset()
  const init: any = await handler(fixture({
    body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' }
  }))
  await assert.rejects(
    () => handler(fixture({
      body: { umo: UMO, step: 'confirm', pendingToken: init.pendingToken, password: 'Another-Pass1!' }
    })),
    (error: any) => error.statusCode === 400 && /不一致/.test(error.message)
  )
  assert.equal((globalThis as any).__prUpdates.length, 0)
})

test('confirm：密码不满足站点策略被拒绝（含 init 阶段）', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({ body: { umo: UMO, step: 'init', password: 'short' } })),
    (error: any) => error.statusCode === 400
  )
})

test('未绑定会话被拒绝（403）且不进频控', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({ binding: null, body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' } })),
    (error: any) => error.statusCode === 403
  )
  assert.equal((globalThis as any).__prRateCalls.length, 0)
})

test('非私聊 UMO 形态被拒绝（400）', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({ body: { umo: 'aiocqhttp:GroupMessage:10086', step: 'init', password: 'N3w-Passw0rd!' } })),
    (error: any) => error.statusCode === 400
  )
})

test('绑定平台被站点停用后拒绝（403）', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({ platforms: { qq: false }, body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' } })),
    (error: any) => error.statusCode === 403
  )
})

test('适配器与绑定平台归类不一致时拒绝（403）', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({
      binding: { userId: 7, platform: 'qq', adapter: 'unknown-adapter' },
      body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' }
    })),
    (error: any) => error.statusCode === 403
  )
})

test('confirm：未 init 直接确认（伪造令牌）被拒绝，防跳过第一步', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({
      body: { umo: UMO, step: 'confirm', pendingToken: 'forged-token', password: 'N3w-Passw0rd!' }
    })),
    (error: any) => error.statusCode === 400
  )
  assert.equal((globalThis as any).__prUpdates.length, 0)
})

test('频控实参：IP 维度使用真实客户端 IP，而非 purpose 常量', async () => {
  reset()
  await handler(fixture({ body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' } }))
  const calls = (globalThis as any).__prRateCalls
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], [7, '203.0.113.7', 'RESET_PASSWORD', 10])
})

test('令牌错误时端点拒绝（401）', async () => {
  reset()
  await assert.rejects(
    () => handler(fixture({
      headerToken: 'wrong-token',
      body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' }
    })),
    (error: any) => error.statusCode === 401
  )
})

test('频控触发时 429 且不入队审计之外的写操作', async () => {
  reset()
  ;(globalThis as any).__prRateLimited = true
  await assert.rejects(
    () => handler(fixture({ body: { umo: UMO, step: 'init', password: 'N3w-Passw0rd!' } })),
    (error: any) => error.statusCode === 429
  )
  assert.equal((globalThis as any).__prUpdates.length, 0)
})
