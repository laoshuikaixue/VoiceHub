import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

/**
 * 真正运行 server/utils/astrbot-password-reset.ts 的密封令牌逻辑。
 * seal/unseal 依赖 JWT_SECRET；tickets → errors → apiError 链仅桩掉 h3，
 * 其余（constants 纯文件、serverTime、crypto）走真实实现。
 */
process.env.JWT_SECRET = 'test-secret-for-astrbot-password-reset-cache'

const modulePath = fileURLToPath(new URL('../../server/utils/astrbot-password-reset.ts', import.meta.url))
const resolveDir = fileURLToPath(new URL('../../', import.meta.url))

const mod = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(modulePath)}`,
    resolveDir,
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'h3-stub',
    setup(b) {
      b.onResolve({ filter: /^h3$/ }, () => ({ path: 'h3', namespace: 'h3-stub' }))
      b.onLoad({ filter: /.*/, namespace: 'h3-stub' }, () => ({
        contents: `export const createError = opts => Object.assign(new Error(opts.message), opts);`,
        loader: 'js'
      }))
    }
  }]
})

const {
  createPendingPasswordReset,
  consumePendingPasswordReset,
  consumedPasswordResetCount,
  PASSWORD_RESET_PENDING_TTL_SECONDS
} = await import(
  'data:text/javascript;base64,' + Buffer.from(mod.outputFiles[0].text).toString('base64')
)

test('创建后可按 pendingToken 消费，且只能消费一次', () => {
  const created = createPendingPasswordReset({
    umo: 'aiocqhttp:FriendMessage:123',
    userId: 7,
    password: 'N3w-Pass!'
  })
  assert.ok(typeof created.pendingToken === 'string' && created.pendingToken.length > 8)
  assert.equal(created.expiresInSeconds, PASSWORD_RESET_PENDING_TTL_SECONDS)
  assert.equal(PASSWORD_RESET_PENDING_TTL_SECONDS, 300)

  const first = consumePendingPasswordReset(created.pendingToken)
  assert.deepEqual(
    { umo: first?.umo, userId: first?.userId, password: first?.password },
    { umo: 'aiocqhttp:FriendMessage:123', userId: 7, password: 'N3w-Pass!' }
  )
  // 一次性：第二次消费返回 null
  assert.equal(consumePendingPasswordReset(created.pendingToken), null)
})

test('伪造/非法令牌返回 null', () => {
  assert.equal(consumePendingPasswordReset('nope'), null)
  assert.equal(consumePendingPasswordReset(undefined), null)
  assert.equal(consumePendingPasswordReset(''), null)
  assert.equal(consumePendingPasswordReset({ not: 'a token' }), null)
  // 篡改密封令牌载荷应因签名校验失败被拒绝
  const created = createPendingPasswordReset({ umo: 'u:1', userId: 1, password: 'x' })
  const tampered = created.pendingToken.slice(0, -4) + 'AAAA'
  assert.equal(consumePendingPasswordReset(tampered), null)
})

test('过期令牌不可消费', () => {
  const created = createPendingPasswordReset(
    { umo: 'u:1', userId: 1, password: 'x' },
    { ttlSeconds: -1 }
  )
  assert.equal(consumePendingPasswordReset(created.pendingToken, { ttlSeconds: -1 }), null)
})

test('并发不串号：两个 pending 互不影响', () => {
  const a = createPendingPasswordReset({ umo: 'u:a', userId: 1, password: 'pa' })
  const b = createPendingPasswordReset({ umo: 'u:b', userId: 2, password: 'pb' })
  assert.notEqual(a.pendingToken, b.pendingToken)
  const first = consumePendingPasswordReset(b.pendingToken)
  assert.equal(first?.userId, 2)
  const second = consumePendingPasswordReset(a.pendingToken)
  assert.equal(second?.userId, 1)
})

test('消费记录惰性清扫：过期记录不驻留内存', () => {
  const created = createPendingPasswordReset({ umo: 'u:sweep', userId: 1, password: 'x' })
  // ttlSeconds: -1 使消费记录立即视为已过期
  consumePendingPasswordReset(created.pendingToken, { ttlSeconds: -1 })
  const base = consumedPasswordResetCount()
  assert.ok(base >= 1)
  // 下一次 create 触发清扫：过期消费记录被移除
  createPendingPasswordReset({ umo: 'u:fresh', userId: 2, password: 'y' })
  assert.equal(consumedPasswordResetCount(), base - 1 >= 0 ? base - 1 : 0)
})
