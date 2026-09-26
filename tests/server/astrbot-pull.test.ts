import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isAstrbotPullMode,
  parseAstrbotAckResults,
  toAstrbotPullItem,
  isAstrbotOutboxExhausted
} from '../../server/utils/astrbot-pull.ts'

test('仅显式 pull 才走拉取，其余（含 undefined）按 push 处理', () => {
  assert.equal(isAstrbotPullMode('pull'), true)
  assert.equal(isAstrbotPullMode('push'), false)
  assert.equal(isAstrbotPullMode(undefined), false)
  assert.equal(isAstrbotPullMode(null), false)
  assert.equal(isAstrbotPullMode('PULL'), false)
  assert.equal(isAstrbotPullMode(1), false)
})

test('队列行转取件条目时补齐缺省值', () => {
  const claimToken = 'a'.repeat(64)
  const item = toAstrbotPullItem({
    id: 7, title: null, message: '正文', url: null, umos: ['default:FriendMessage:1'], broadcast: false, claimToken
  })
  assert.deepEqual(item, {
    id: 7, title: '', content: '正文', umos: ['default:FriendMessage:1'], broadcast: false, claimToken
  })
  // url 为 null 时不应出现空字符串字段
  assert.equal('url' in item, false)
})

test('队列行的 umos 为 null 时降级为空数组，避免插件侧解析异常', () => {
  const item = toAstrbotPullItem({
    id: 8, title: 't', message: 'm', url: 'https://x', umos: null, broadcast: true, claimToken: 'b'.repeat(64)
  })
  assert.deepEqual(item.umos, [])
  assert.equal(item.url, 'https://x')
  assert.equal(item.broadcast, true)
})

test('回执形状非法时整体拒绝，不做部分接受', () => {
  assert.equal(parseAstrbotAckResults(null), null)
  assert.equal(parseAstrbotAckResults({}), null)
  assert.equal(parseAstrbotAckResults({ results: [] }), null)
  assert.equal(parseAstrbotAckResults({ results: 'x' }), null)
  // 一条非法即整体拒绝，避免半截回执把未投递条目误标成功
  assert.equal(parseAstrbotAckResults({ results: [{ id: 1, success: true }, { id: 0, success: true }] }), null)
  assert.equal(parseAstrbotAckResults({ results: [{ id: 1 }] }), null)
  assert.equal(parseAstrbotAckResults({ results: [{ id: 1, success: 'yes' }] }), null)
  assert.equal(parseAstrbotAckResults({ results: Array.from({ length: 101 }, (_, i) => ({ id: i + 1, success: true })) }), null)
})

test('合法回执被规范化，reason 缺省为空串', () => {
  const claimToken = 'c'.repeat(64)
  const parsed = parseAstrbotAckResults({
    results: [{ id: 2, claimToken, success: false, reason: 'boom' }, { id: 1, claimToken, success: true }]
  })
  assert.deepEqual(parsed, [
    { id: 2, claimToken, success: false, reason: 'boom', failedUmos: null },
    { id: 1, claimToken, success: true, reason: '', failedUmos: null }
  ])
})

test('部分失败回执只允许唯一的失败目标，成功回执不能携带失败目标', () => {
  const claimToken = 'd'.repeat(64)
  assert.deepEqual(parseAstrbotAckResults({ results: [{ id: 3, claimToken, success: false,
    failedUmos: ['adapter:FriendMessage:3'] }] })?.[0].failedUmos, ['adapter:FriendMessage:3'])
  for (const failedUmos of [[], ['x', 'x'], [2], ['']]) {
    assert.equal(parseAstrbotAckResults({ results: [{ id: 3, claimToken, success: false, failedUmos }] }), null)
  }
  assert.equal(parseAstrbotAckResults({ results: [{ id: 3, claimToken, success: true,
    failedUmos: ['x'] }] }), null)
})

test('无领取令牌或伪造令牌不能回执', () => {
  assert.equal(parseAstrbotAckResults({ results: [{ id: 1, success: true }] }), null)
  assert.equal(parseAstrbotAckResults({ results: [{ id: 1, claimToken: 'invalid', success: true }] }), null)
})

test('尝试上限：达到 3 次后停止重试', () => {
  assert.equal(isAstrbotOutboxExhausted(1), false)
  assert.equal(isAstrbotOutboxExhausted(2), false)
  assert.equal(isAstrbotOutboxExhausted(3), true)
  assert.equal(isAstrbotOutboxExhausted(4), true)
})
