import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ASTRBOT_BIND_TTL_SECONDS,
  createAstrbotBindCode,
  equalAstrbotToken,
  hashAstrbotBindCode,
  normalizeAstrbotBaseUrl,
  parseAstrbotPrivateUmo
} from '../../server/utils/astrbot-notification.ts'
import { isPublicApiPath } from '../../server/utils/auth-route-policy.ts'

test('绑定码为随机 24 位十六进制，摘要不等于明文', () => {
  const a = createAstrbotBindCode()
  const b = createAstrbotBindCode()
  assert.match(a, /^[a-f0-9]{24}$/)
  assert.notEqual(a, b)
  assert.notEqual(hashAstrbotBindCode(a), a)
  assert.equal(ASTRBOT_BIND_TTL_SECONDS, 600)
})

test('只允许所支持平台的私聊 UMO', () => {
  assert.deepEqual(parseAstrbotPrivateUmo('one:FriendMessage:alice', 'qq_official'), {
    umo: 'one:FriendMessage:alice', platform: 'qq_official'
  })
  assert.equal(parseAstrbotPrivateUmo('one:GroupMessage:123', 'aiocqhttp'), null)
  assert.equal(parseAstrbotPrivateUmo('one:FriendMessage:abc:def', 'lark'), null)
  assert.equal(parseAstrbotPrivateUmo('one:FriendMessage:123', 'unknown'), null)
  assert.equal(parseAstrbotPrivateUmo('one:FriendMessage:', 'lark'), null)
})

test('机器人服务地址仅接受无凭证 HTTP(S) 根地址', () => {
  assert.equal(normalizeAstrbotBaseUrl('https://astrbot.example.com:6199/'), 'https://astrbot.example.com:6199')
  assert.equal(normalizeAstrbotBaseUrl('http://127.0.0.1:6199'), 'http://127.0.0.1:6199')
  for (const bad of ['file:///tmp/x', 'https://user:pass@example.com', 'https://example.com/foo',
    'https://example.com/?x=1', 'invalid']) assert.equal(normalizeAstrbotBaseUrl(bad), null)
})

test('令牌校验拒绝缺失、错误及长度不同的值', () => {
  assert.equal(equalAstrbotToken('secret', 'secret'), true)
  assert.equal(equalAstrbotToken('secret', 'secreT'), false)
  assert.equal(equalAstrbotToken('short', 'much longer'), false)
  assert.equal(equalAstrbotToken('', 'secret'), false)
})

test('机器人回调不列入通用公开路由白名单，由中间件精确放行并在端点校验令牌', () => {
  for (const path of ['/api/bot/voicehub/bind', '/api/bot/voicehub/unbind']) {
    assert.equal(isPublicApiPath(path, 'POST'), false)
    assert.equal(isPublicApiPath(path, 'GET'), false)
  }
  assert.equal(isPublicApiPath('/api/bot/voicehub/other', 'POST'), false)
})
