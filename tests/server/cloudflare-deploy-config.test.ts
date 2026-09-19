import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCloudflareDeployConfig } from '../../scripts/inject-cloudflare-config.js'

test('Cloudflare 生成配置保留控制台变量并注入 Hyperdrive', () => {
  assert.deepEqual(
    applyCloudflareDeployConfig(
      {
        name: 'voicehub',
        main: './server/index.mjs',
        assets: { directory: './public' }
      },
      '0123456789abcdef0123456789abcdef'
    ),
    {
      name: 'voicehub',
      main: './server/index.mjs',
      assets: { directory: './public' },
      keep_vars: true,
      hyperdrive: [
        {
          binding: 'HYPERDRIVE',
          id: '0123456789abcdef0123456789abcdef'
        }
      ]
    }
  )
})

test('未提供 Hyperdrive ID 时不伪造绑定', () => {
  assert.deepEqual(applyCloudflareDeployConfig({ name: 'voicehub' }, ''), {
    name: 'voicehub',
    keep_vars: true
  })
})
