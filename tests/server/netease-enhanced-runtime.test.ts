import assert from 'node:assert/strict'
import test from 'node:test'
import { isNeteaseEnhancedApiAvailable } from '../../server/utils/netease-enhanced-runtime.ts'

test('网易云增强 API 在 Cloudflare Workers 禁用', () => {
  assert.equal(isNeteaseEnhancedApiAvailable('Cloudflare-Workers'), false)
})

test('网易云增强 API 在 Node 运行时保持可用', () => {
  assert.equal(isNeteaseEnhancedApiAvailable(undefined), true)
  assert.equal(isNeteaseEnhancedApiAvailable('Node.js'), true)
})
