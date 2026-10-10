import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

/**
 * 真正运行 server/utils/astrbot-password-reset.ts 的 pending 缓存逻辑。
 * esbuild bundle 后以全局计数数组挂 globalThis 的方式（与既有路由测试一致）
 * 不适用——这里模块无外部依赖，直接 bundle 后调用导出函数即可。
 */
const mod = await build({
  stdin: {
    contents: `
      export * from '/opt/data/workspace/voicehub/server/utils/astrbot-password-reset.ts'
    `,
    resolveDir: '/opt/data/workspace/voicehub',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node'
})

const {
  createPendingPasswordReset,
  consumePendingPasswordReset,
  PASSWORD_RESET_PENDING_TTL_SECONDS
} = await import(
  'data:text/javascript;base64,' + Buffer.from(mod.outputFiles[0].text).toString('base64')
)

test('创建后可按 jti 消费，且只能消费一次', () => {
  const created = createPendingPasswordReset({
    umo: 'aiocqhttp:FriendMessage:123',
    userId: 7,
    password: 'N3w-Pass!'
  })
  assert.ok(created.jti.length > 8)
  assert.equal(created.expiresInSeconds, PASSWORD_RESET_PENDING_TTL_SECONDS)
  assert.equal(PASSWORD_RESET_PENDING_TTL_SECONDS, 300)

  const first = consumePendingPasswordReset(created.jti)
  assert.deepEqual(
    { umo: first?.umo, userId: first?.userId, password: first?.password },
    { umo: 'aiocqhttp:FriendMessage:123', userId: 7, password: 'N3w-Pass!' }
  )
  // 一次性：第二次消费返回 null
  assert.equal(consumePendingPasswordReset(created.jti), null)
})

test('未知 jti 返回 null', () => {
  assert.equal(consumePendingPasswordReset('nope'), null)
  assert.equal(consumePendingPasswordReset(undefined), null)
  assert.equal(consumePendingPasswordReset(''), null)
})

test('过期条目不可消费', () => {
  const created = createPendingPasswordReset(
    { umo: 'u:1', userId: 1, password: 'x' },
    { ttlSeconds: -1 }
  )
  assert.equal(consumePendingPasswordReset(created.jti, { ttlSeconds: -1 }), null)
})

test('并发不串号：两个 pending 互不影响', () => {
  const a = createPendingPasswordReset({ umo: 'u:a', userId: 1, password: 'pa' })
  const b = createPendingPasswordReset({ umo: 'u:b', userId: 2, password: 'pb' })
  assert.notEqual(a.jti, b.jti)
  const first = consumePendingPasswordReset(b.jti)
  assert.equal(first?.userId, 2)
  const second = consumePendingPasswordReset(a.jti)
  assert.equal(second?.userId, 1)
})
