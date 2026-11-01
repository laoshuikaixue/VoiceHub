import assert from 'node:assert/strict'
import test from 'node:test'
import { createTtlCache } from '../../server/utils/ttl-cache.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('TTL 内复用缓存，不重复读取', async () => {
  let loads = 0
  const read = createTtlCache(
    async () => {
      loads += 1
      return { value: loads }
    },
    { value: 0 },
    1000
  )

  assert.deepEqual(await read(), { value: 1 })
  assert.deepEqual(await read(), { value: 1 })
  assert.equal(loads, 1)
})

test('过期后重新读取', async () => {
  let loads = 0
  const read = createTtlCache(
    async () => {
      loads += 1
      return { value: loads }
    },
    { value: 0 },
    20
  )

  assert.deepEqual(await read(), { value: 1 })
  await sleep(60)
  assert.deepEqual(await read(), { value: 2 })
})

test('读取返回 null 时走降级值且不写缓存', async () => {
  let loads = 0
  const read = createTtlCache(
    async () => {
      loads += 1
      return null
    },
    { value: 'fallback' },
    1000
  )

  assert.deepEqual(await read(), { value: 'fallback' })
  assert.deepEqual(await read(), { value: 'fallback' })
  assert.equal(loads, 2, '降级结果被写进缓存，后续调用不会重试')
})

test('缓存过期后读取失败返回降级值，且不覆盖已缓存的值', async () => {
  let mode: 'ok' | 'null' = 'ok'
  const read = createTtlCache(
    async () => (mode === 'ok' ? { value: 'loaded' } : null),
    { value: 'fallback' },
    50
  )

  assert.deepEqual(await read(), { value: 'loaded' })
  mode = 'null'
  assert.deepEqual(await read(), { value: 'loaded' }, 'TTL 内应继续命中已缓存的值')
  await sleep(80)
  assert.deepEqual(await read(), { value: 'fallback' })
  mode = 'ok'
  await sleep(80)
  assert.deepEqual(await read(), { value: 'loaded' }, '降级不该把缓存清成空值')
})

test('并发调用只触发一次读取', async () => {
  let loads = 0
  const read = createTtlCache(
    async () => {
      loads += 1
      await sleep(20)
      return { value: loads }
    },
    { value: 0 },
    1000
  )

  const values = await Promise.all([read(), read(), read()])
  assert.deepEqual(values, [{ value: 1 }, { value: 1 }, { value: 1 }])
  assert.equal(loads, 1)
})

test('读取完成后释放 in-flight，后续调用可重新读取', async () => {
  const read = createTtlCache(
    async () => {
      await sleep(10)
      return { value: 1 }
    },
    { value: 0 },
    20
  )

  await Promise.all([read(), read()])
  await sleep(60)
  assert.deepEqual(await read(), { value: 1 })
})

test('读取抛错时不缓存，且不留下挂起的 in-flight', async () => {
  let loads = 0
  const read = createTtlCache(
    async () => {
      loads += 1
      if (loads === 1) {
        throw new Error('db down')
      }
      return { value: loads }
    },
    { value: 0 },
    1000
  )

  await assert.rejects(read(), /db down/)
  assert.deepEqual(await read(), { value: 2 })
})

test('读取函数同步抛错后释放 in-flight，并允许并发重试', async () => {
  let loads = 0
  const read = createTtlCache(
    () => {
      loads += 1
      if (loads === 1) throw new Error('同步读取失败')
      return Promise.resolve({ value: loads })
    },
    { value: 0 },
    1000
  )

  const failed = await Promise.allSettled([read(), read()])
  assert.ok(failed.every((result) => result.status === 'rejected'))
  assert.equal(loads, 1)
  assert.deepEqual(await Promise.all([read(), read()]), [{ value: 2 }, { value: 2 }])
  assert.equal(loads, 2)
})
