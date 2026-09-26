import assert from 'node:assert/strict'
import test from 'node:test'
import { adapterToAstrbotPlatform, isAstrbotPlatformEnabled, parseAstrbotPlatform, selectAstrbotTargets } from '../../server/utils/astrbot-platforms.ts'

test('适配器归类准确，未知适配器不归类', () => {
  for (const adapter of ['aiocqhttp', 'qq_official', 'qq_official_webhook']) assert.equal(adapterToAstrbotPlatform(adapter), 'qq')
  assert.equal(adapterToAstrbotPlatform('wecom_ai_bot'), 'wecom')
  assert.equal(adapterToAstrbotPlatform('dingtalk'), 'dingtalk')
  assert.equal(adapterToAstrbotPlatform('lark'), 'lark')
  assert.equal(adapterToAstrbotPlatform('unknown'), null)
  assert.equal(parseAstrbotPlatform('qq'), 'qq')
  assert.equal(parseAstrbotPlatform('aiocqhttp'), null)
})

test('禁用平台或错误适配器的目标不得投递，UMO 实例前缀不参与适配器判断', () => {
  const rows = [
    { umo: 'renamed:FriendMessage:1', adapter: 'aiocqhttp', platform: 'qq', enabled: true },
    { umo: 'other:FriendMessage:2', adapter: 'lark', platform: 'lark', enabled: true },
    { umo: 'third:FriendMessage:3', adapter: 'wecom_ai_bot', platform: 'qq', enabled: true },
    { umo: 'fourth:GroupMessage:4', adapter: 'dingtalk', platform: 'dingtalk', enabled: true }
  ]
  assert.deepEqual(selectAstrbotTargets(rows, { qq: true, wecom: true, dingtalk: true, lark: false }), ['renamed:FriendMessage:1'])
  assert.equal(isAstrbotPlatformEnabled({ qq: false, wecom: true, dingtalk: true, lark: true }, 'qq'), false)
  assert.equal(isAstrbotPlatformEnabled(null, 'qq'), false)
})
