import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  ASTRBOT_BIND_TTL_SECONDS,
  createAstrbotBindCode,
  equalAstrbotToken,
  hashAstrbotBindCode,
  isSupportedAstrbotPrivateUmo,
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

test('中文平台实例 ID 的私聊 UMO 可绑定，仍拒绝分隔符和控制字符', () => {
  const umo = 'QQ（诺玛劳恩斯）:FriendMessage:1375899646'
  assert.deepEqual(parseAstrbotPrivateUmo(umo, 'aiocqhttp'), { umo, platform: 'aiocqhttp' })
  for (const prefix of ['QQ:副本', 'QQ\n副本', 'QQ\u0000副本', 'QQ 副本']) {
    assert.equal(parseAstrbotPrivateUmo(`${prefix}:FriendMessage:1375899646`, 'aiocqhttp'), null)
  }
})

test('机器人服务地址仅接受无凭证 HTTP(S) 根地址', () => {
  assert.equal(normalizeAstrbotBaseUrl('https://astrbot.example.com:6199/'), 'https://astrbot.example.com:6199')
  assert.equal(normalizeAstrbotBaseUrl('http://127.0.0.1:6199'), 'http://127.0.0.1:6199')
  for (const bad of ['file:///tmp/x', 'https://user:pass@example.com', 'https://example.com/foo',
    'https://example.com/?x=1', 'invalid']) assert.equal(normalizeAstrbotBaseUrl(bad), null)
})

test('目标校验与绑定共用同一套平台白名单与私聊形态判定', () => {
  assert.equal(isSupportedAstrbotPrivateUmo('aiocqhttp:FriendMessage:user1'), true)
  assert.equal(isSupportedAstrbotPrivateUmo('qq_official:FriendMessage:ABCDEF'), true)
  for (const bad of ['bot:FriendMessage:user', 'unknown:FriendMessage:user',
    'aiocqhttp:GroupMessage:123', 'aiocqhttp:OtherMessage:1', 'aiocqhttp:FriendMessage:',
    '', 42, null, 'aiocqhttp:FriendMessage:a:b']) {
    assert.equal(isSupportedAstrbotPrivateUmo(bad), false)
  }
  assert.equal(isSupportedAstrbotPrivateUmo(`aiocqhttp:FriendMessage:${'x'.repeat(512)}`), false)
})

test('令牌校验拒绝缺失、错误及长度不同的值', () => {
  assert.equal(equalAstrbotToken('secret', 'secret'), true)
  assert.equal(equalAstrbotToken('secret', 'secreT'), false)
  assert.equal(equalAstrbotToken('short', 'much longer'), false)
  assert.equal(equalAstrbotToken('', 'secret'), false)
})

test('机器人回调不列入通用公开路由白名单，由中间件精确放行并在端点校验令牌', () => {
  for (const path of ['/api/bot/voicehub/bind', '/api/bot/voicehub/unbind', '/api/bot/voicehub/verify-targets']) {
    assert.equal(isPublicApiPath(path, 'POST'), false)
    assert.equal(isPublicApiPath(path, 'GET'), false)
  }
  assert.equal(isPublicApiPath('/api/bot/voicehub/other', 'POST'), false)
})

test('群广播仅在全员范围开启，且只随一次空目标批次发送', () => {
  const send = readFileSync(new URL('../../server/api/admin/notifications/send.post.ts', import.meta.url), 'utf8')
  const sender = readFileSync(new URL('../../app/components/Admin/NotificationSender.vue', import.meta.url), 'utf8')
  const service = readFileSync(new URL('../../server/services/astrbotNotificationService.ts', import.meta.url), 'utf8')
  assert.match(send, /body\?\.broadcast === true && scope !== 'ALL'/)
  assert.match(sender, /broadcast: form\.value\.scope === 'ALL' && form\.value\.broadcast/)
  assert.match(sender, /v-if="form\.scope === 'ALL'"/)
  assert.match(service, /shouldBroadcast && chunk\.length === 0/)
})

test('绑定、解绑及发码使用同一用户行锁，绑定码仅在所有校验完成后消耗', () => {
  const source = (path: string) => readFileSync(new URL(`../../server/api/${path}`, import.meta.url), 'utf8')
  const bind = source('bot/voicehub/bind.post.ts')
  const botUnbind = source('bot/voicehub/unbind.post.ts')
  const userUnbind = source('notifications/astrbot/unbind.post.ts')
  const issue = source('notifications/astrbot/bind-code.post.ts')
  for (const text of [bind, userUnbind, issue]) {
    assert.match(text, /db\.transaction\(async \(tx\) =>/)
    assert.match(text, /\.from\(users\)[\s\S]*?\.for\('update'\)/)
  }
  assert.ok(bind.indexOf(".for('update')") < bind.indexOf('.update(astrbotBindingCodes)'))
  assert.ok(bind.indexOf('ASTRBOT_UMO_BOUND') < bind.indexOf('.update(astrbotBindingCodes)'))
  assert.match(bind, /eq\(astrbotBindingCodes\.userId, codeRow\.userId\)/)
  assert.match(bind, /eq\(astrbotBindingCodes\.codeHash, hash\)/)
  assert.match(bind, /gt\(astrbotBindingCodes\.expiresAt, getServerDate\(\)\)/)
  assert.match(bind, /isNull\(astrbotBindingCodes\.consumedAt\)/)
  assert.doesNotMatch(bind, /attempts\} < 5/)
  assert.match(botUnbind, /db\.transaction\(async \(tx\) =>/)
  assert.match(botUnbind, /\.from\(users\)[\s\S]*?\.for\('update'\)/)
  assert.match(botUnbind, /tx\.delete\(astrbotBindingCodes\)/)
  assert.match(botUnbind, /account\?\.umo !== umo/)
  assert.match(userUnbind, /tx\.delete\(astrbotBindingCodes\)/)
  assert.match(issue, /tx\.insert\(astrbotBindingCodes\)/)
})
