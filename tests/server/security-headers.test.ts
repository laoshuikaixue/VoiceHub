import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { createApp, defineEventHandler, getHeader, setHeader, toWebHandler } from 'h3'
import ts from 'typescript'

test('页面允许本站申请麦克风，保留其他设备限制', async () => {
  const source = readFileSync(new URL('../../server/middleware/01.security-headers.ts', import.meta.url), 'utf8')
  const handler = runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('export default ', ''),
    { defineEventHandler, getHeader, setHeader }
  )
  const app = createApp()
  app.use(handler)
  app.use(defineEventHandler(() => '测试页面'))
  const response = await toWebHandler(app)(new Request('http://localhost/'))
  assert.equal(response.status, 200)
  const policy = response.headers.get('permissions-policy')!
  const directives = new Map(policy.split(',').map((value) => {
    const [name, allowlist] = value.trim().split('=')
    return [name, allowlist]
  }))
  assert.equal(directives.get('microphone'), '(self)')
  for (const feature of ['geolocation', 'camera', 'payment', 'usb', 'magnetometer', 'gyroscope', 'accelerometer']) {
    assert.equal(directives.get(feature), '()')
  }
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN')
})
