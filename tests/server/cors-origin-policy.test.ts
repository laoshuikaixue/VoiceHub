import assert from 'node:assert/strict'
import test from 'node:test'
import { isTrustedOrigin, normalizeOrigin } from '../../server/utils/request-utils.ts'

test('允许 HTTPS 来源访问按 HTTP 配置的同主机内部 API', () => {
  const source = normalizeOrigin('https://voicehub.hyzx1915.top', 'http:')
  const trusted = normalizeOrigin('http://voicehub.hyzx1915.top', 'http:')

  assert.equal(isTrustedOrigin(source, trusted), true)
})

test('同主机但协议降级仍按跨域拦截', () => {
  const source = normalizeOrigin('http://voicehub.hyzx1915.top', 'https:')
  const trusted = normalizeOrigin('https://voicehub.hyzx1915.top', 'https:')

  assert.equal(isTrustedOrigin(source, trusted), false)
})

test('主机名或端口不同不能视为可信来源', () => {
  assert.equal(
    isTrustedOrigin(
      normalizeOrigin('https://voicehub.hyzx1915.top', 'http:'),
      normalizeOrigin('http://evil.example.com', 'http:')
    ),
    false
  )
  assert.equal(
    isTrustedOrigin(
      normalizeOrigin('https://voicehub.hyzx1915.top:8443', 'http:'),
      normalizeOrigin('http://voicehub.hyzx1915.top:9443', 'http:')
    ),
    false
  )
})

test('协议升级时保留显式端口匹配', () => {
  assert.equal(
    isTrustedOrigin(
      normalizeOrigin('https://voicehub.hyzx1915.top:8443', 'http:'),
      normalizeOrigin('http://voicehub.hyzx1915.top:8443', 'http:')
    ),
    true
  )
})

test('相同来源仍然可信', () => {
  assert.equal(
    isTrustedOrigin(
      normalizeOrigin('https://voicehub.hyzx1915.top', 'https:'),
      normalizeOrigin('https://voicehub.hyzx1915.top', 'https:')
    ),
    true
  )
})
