import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, test } from 'node:test'
import vm from 'node:vm'

const loadCjsStub = (path: string) => {
  const module: { exports: Record<string, unknown> } = { exports: {} }
  vm.runInNewContext(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    module,
    exports: module.exports,
    process,
    console,
    Proxy
  })
  return module.exports
}

const originalDebug = process.env.DEBUG

afterEach(() => {
  if (originalDebug === undefined) delete process.env.DEBUG
  else process.env.DEBUG = originalDebug
})

test('debug stub 默认关闭日志', () => {
  delete process.env.DEBUG
  const debug = loadCjsStub('../../deploy/stubs/debug.cjs')
  const logger = debug('voicehub:test')
  assert.equal(logger.enabled, false)
})

test('debug stub 仅在命名空间匹配时启用', () => {
  process.env.DEBUG = 'voicehub:*'
  const debug = loadCjsStub('../../deploy/stubs/debug.cjs')
  assert.equal(debug('voicehub:test').enabled, true)
  assert.equal(debug('other:test').enabled, false)
})

test('express stub 返回可链式调用的应用对象', () => {
  const express = loadCjsStub('../../deploy/stubs/express.cjs')
  const app = express()
  assert.equal(typeof app.use, 'function')
  assert.equal(typeof app.listen, 'function')
  assert.doesNotThrow(() => app.use('/api', () => {}).listen(3000))
})

test('Sentry stub scope 覆盖现有插件使用的 API', async () => {
  const Sentry = await import('../../deploy/stubs/sentry-node.mjs')
  let called = false
  Sentry.withScope((scope) => {
    assert.equal(typeof scope.setContext, 'function')
    assert.equal(typeof scope.setTag, 'function')
    assert.equal(typeof scope.setUser, 'function')
    assert.equal(typeof scope.setLevel, 'function')
    scope.setLevel('error')
    called = true
  })
  assert.equal(called, true)
})
