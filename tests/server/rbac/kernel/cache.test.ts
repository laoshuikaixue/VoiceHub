/**
 * S2-1 单测：RBAC 缓存（TTL / in-flight 去重 / 失效 / store 谓词）。
 * 时钟用假时钟注入，不依赖真实等待。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_TTL_MS,
  createPermissionCache
} from '../../../../server/utils/rbac/cache.ts'

function createClock(start = 1_000_000) {
  let current = start
  return {
    now: () => current,
    advance: (ms) => {
      current += ms
    }
  }
}

test('S2-1 缓存：默认 TTL 为 60s，命中期内不重复调用 loader', async () => {
  const clock = createClock()
  const cache = createPermissionCache({ now: clock.now })
  let calls = 0
  const loader = async () => {
    calls += 1
    return new Set(['song.read'])
  }

  await cache.load(7, loader)
  await cache.load(7, loader)
  assert.equal(calls, 1)
  assert.equal(cache.size(), 1)

  clock.advance(DEFAULT_TTL_MS - 1)
  await cache.load(7, loader)
  assert.equal(calls, 1, 'TTL 内必须命中缓存')
})

test('S2-1 缓存：TTL 过期后重新加载', async () => {
  const clock = createClock()
  const cache = createPermissionCache({ now: clock.now, ttlMs: 50 })
  let calls = 0
  const loader = async () => {
    calls += 1
    return new Set(['song.read'])
  }

  await cache.load(1, loader)
  clock.advance(51)
  await cache.load(1, loader)
  assert.equal(calls, 2, '过期后必须重新加载')
})

test('S2-1 缓存：并发同 userId 只触发一次 loader（in-flight 去重）', async () => {
  const clock = createClock()
  const cache = createPermissionCache({ now: clock.now })
  let calls = 0
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })

  const loader = async () => {
    calls += 1
    await gate
    return new Set(['user.read'])
  }

  const [first, second, third] = [cache.load(3, loader), cache.load(3, loader), cache.load(3, loader)]
  release()

  const results = await Promise.all([first, second, third])
  assert.equal(calls, 1)
  assert.equal(cache.inflightSize(), 0)
  for (const result of results) assert.deepEqual([...result], ['user.read'])
})

test('S2-1 缓存：invalidate / invalidateAll 立即生效', async () => {
  const clock = createClock()
  const cache = createPermissionCache({ now: clock.now })
  let calls = 0
  const loader = async () => {
    calls += 1
    return new Set(['song.read'])
  }

  await cache.load(1, loader)
  await cache.load(2, loader)
  assert.equal(cache.size(), 2)

  cache.invalidate(1)
  await cache.load(1, loader)
  assert.equal(calls, 3, 'invalidate 后必须重新加载')

  cache.invalidateAll()
  assert.equal(cache.size(), 0)
  await cache.load(2, loader)
  assert.equal(calls, 4)
})

test('S2-1 缓存：store 谓词可拒绝缓存（degraded 态不入缓存）', async () => {
  const clock = createClock()
  const cache = createPermissionCache({ now: clock.now })
  let calls = 0
  const loader = async () => {
    calls += 1
    return { degraded: true }
  }

  const options = { store: (value) => !value.degraded }
  await cache.load(9, loader, options)
  await cache.load(9, loader, options)

  assert.equal(calls, 2, '被 store 拒绝的结果不得缓存')
  assert.equal(cache.size(), 0)

  cache.set(9, { degraded: false })
  assert.equal(cache.size(), 1)
  assert.equal(cache.get(9)?.degraded, false)
})
