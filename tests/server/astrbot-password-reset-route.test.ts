import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { createApp, toWebHandler } from 'h3'

test('旧机器人改密接口始终提示网页恢复且不依赖数据库或密码服务', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const result = await build({
    entryPoints: [`${root}/server/api/bot/voicehub/password-reset.post.ts`],
    alias: { '~~': root }, bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'use-h3', setup: plugin => {
      plugin.onResolve({ filter: /^h3$/ }, ({ path }) => ({ path: import.meta.resolve(path), external: true }))
    } }],
    metafile: true
  })
  assert.ok(Object.keys(result.metafile.inputs).every(path => !/passwordSecurityService|userService|drizzle\//.test(path)))
  const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`)
  const app = createApp({ onError: () => {} }).use(handler)
  const response = await toWebHandler(app)(new Request('http://localhost/api/bot/voicehub/password-reset', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-voicehub-token': 'old-token' },
    body: 'invalid JSON'
  }))
  assert.equal(response.status, 410)
  assert.equal((await response.json()).data.code, 'ASTRBOT_PASSWORD_RESET_WEB_REQUIRED')
})
