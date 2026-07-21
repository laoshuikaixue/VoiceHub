import assert from 'node:assert/strict'
import test from 'node:test'
import { JWTEnhanced } from '../../server/utils/jwt-enhanced.ts'

test('预认证令牌必须携带当前 tokenVersion', () => {
  assert.equal(JWTEnhanced.hasCurrentTokenVersion({ tokenVersion: 3 }, 3), true)
  assert.equal(JWTEnhanced.hasCurrentTokenVersion({ tokenVersion: 2 }, 3), false)
})

test('迁移前或非法 tokenVersion 的预认证令牌按失效处理', () => {
  assert.equal(JWTEnhanced.hasCurrentTokenVersion({}, 0), false)
  assert.equal(JWTEnhanced.hasCurrentTokenVersion({ tokenVersion: '0' }, 0), false)
  assert.equal(JWTEnhanced.hasCurrentTokenVersion(null, 0), false)
})
