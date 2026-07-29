import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import {
  decodeOAuthStateCookie,
  encodeOAuthStateCookie,
  generateState,
  parseState
} from '../../server/utils/oauth.ts'

test('OAuth state Cookie 可以安全保存标准 Base64 特殊字符', () => {
  const state = Buffer.from([251, 255]).toString('base64')
  assert.equal(state, '+/8=')

  const encoded = encodeOAuthStateCookie(state)
  assert.equal(encoded, 'b64url:-_8')
  assert.equal(decodeOAuthStateCookie(encoded), state)
})

test('OAuth state Cookie 对多组随机 Base64 保持往返一致', () => {
  for (let length = 1; length <= 64; length += 1) {
    const state = randomBytes(length).toString('base64')
    assert.equal(decodeOAuthStateCookie(encodeOAuthStateCookie(state)), state)
  }
})

test('OAuth state Cookie 兼容旧版无前缀值', () => {
  const legacyState = '+/8='
  assert.equal(decodeOAuthStateCookie(legacyState), legacyState)
})

test('OAuth state Cookie 拒绝空值、非法字符和非规范 Base64URL', () => {
  assert.equal(decodeOAuthStateCookie('b64url:'), '')
  assert.equal(decodeOAuthStateCookie('b64url:abc='), '')
  assert.equal(decodeOAuthStateCookie('b64url:abc+def'), '')
  assert.equal(decodeOAuthStateCookie('b64url:a'), '')
})

test('生成的 OAuth state 经过 Cookie 编解码后仍可验证', () => {
  const origin = 'https://voicehub.example.com'
  const secret = 'oauth-state-cookie-test-secret'
  const { state, csrf } = generateState(origin, 'aggregate', secret, '/account', 'qq')
  const restoredState = decodeOAuthStateCookie(encodeOAuthStateCookie(state))
  const parsed = parseState(restoredState, origin, csrf, secret)

  assert.equal(parsed?.target, origin)
  assert.equal(parsed?.provider, 'aggregate')
  assert.equal(parsed?.returnTo, '/account')
  assert.equal(parsed?.loginType, 'qq')
})
