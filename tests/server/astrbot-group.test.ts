import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ASTRBOT_GROUP_EVENT_KEYS,
  appendAstrbotGroupContent,
  canMergeAstrbotGroupEvent,
  computeAstrbotGroupNotifyAfter,
  isAstrbotGroupEventEnabled,
  isAstrbotGroupTargetAllowed,
  isAstrbotGroupUmoShape,
  normalizeAstrbotGroupEvents,
  normalizeAstrbotGroupTargets,
  normalizeAstrbotGroupThrottle,
  selectAstrbotGroupTargets
} from '../../server/utils/astrbot-group.ts'

const platforms = { qq: true, wecom: true, dingtalk: false, lark: false }
const groupUmo = 'default:GroupMessage:72927968'

test('群会话形态：仅接受三段式 GroupMessage，拒绝私聊与其他脏值', () => {
  assert.ok(isAstrbotGroupUmoShape(groupUmo))
  assert.ok(isAstrbotGroupUmoShape('renamed-instance:GroupMessage:123'))
  for (const bad of [
    'default:FriendMessage:123',
    'default:GroupMessage:',
    ':GroupMessage:123',
    'default:GroupMessage:12:34',
    'default:GroupMessage:12 34',
    'default:GroupMessage:12\n34',
    '',
    null,
    123
  ]) {
    assert.equal(isAstrbotGroupUmoShape(bad), false, `应拒绝 ${JSON.stringify(bad)}`)
  }
})

test('群目标规范化：丢弃非法项、去重、限制平台为受支持值', () => {
  const targets = normalizeAstrbotGroupTargets([
    { umo: groupUmo, platform: 'qq', label: ' 主群 ' },
    { umo: groupUmo, platform: 'lark', label: '重复会话' },
    { umo: 'default:FriendMessage:1', platform: 'qq', label: '私聊混入' },
    { umo: 'default:GroupMessage:2', platform: 'telegram', label: '平台不支持' },
    { umo: 'default:GroupMessage:3', platform: 'wecom' },
    'not-an-object'
  ])
  assert.deepEqual(targets, [
    { umo: groupUmo, platform: 'qq', label: '主群' },
    { umo: 'default:GroupMessage:3', platform: 'wecom', label: '' }
  ])
  // 入参不是数组时返回 null，调用方据此拒绝请求而不是静默清空配置。
  assert.equal(normalizeAstrbotGroupTargets('nope'), null)
  assert.deepEqual(normalizeAstrbotGroupTargets([]), [])
})

test('事件开关规范化：未知键丢弃、缺失回退默认、非布尔不生效', () => {
  const events = normalizeAstrbotGroupEvents({ songRequest: false, unknownKey: true, backupFailed: 'yes' })
  assert.equal(events.songRequest, false)
  assert.equal(events.backupFailed, true)
  assert.equal(events.registrationPending, true)
  assert.equal(Object.hasOwn(events, 'unknownKey'), false)
  assert.deepEqual(Object.keys(events).sort(), [...ASTRBOT_GROUP_EVENT_KEYS].sort())
  assert.equal(isAstrbotGroupEventEnabled({ songPlayed: true }, 'songPlayed'), true)
  assert.equal(isAstrbotGroupEventEnabled(null, 'songPlayed'), false)
})

test('节流参数规范化：越界与非法值回退默认，不会得到 0 或负数导致放弃合并', () => {
  assert.deepEqual(normalizeAstrbotGroupThrottle({ mergeWindowSeconds: 120, minIntervalSeconds: 30 }),
    { mergeWindowSeconds: 120, minIntervalSeconds: 30 })
  assert.deepEqual(normalizeAstrbotGroupThrottle(null), { mergeWindowSeconds: 300, minIntervalSeconds: 60 })
  // 0 是合法值（表示不合并），必须保留为 0 而不是回退默认。
  assert.equal(normalizeAstrbotGroupThrottle({ mergeWindowSeconds: 0, minIntervalSeconds: 0 }).mergeWindowSeconds, 0)
  assert.equal(normalizeAstrbotGroupThrottle({ mergeWindowSeconds: -5, minIntervalSeconds: 99999 }).mergeWindowSeconds, 0)
  assert.equal(normalizeAstrbotGroupThrottle({ mergeWindowSeconds: -5, minIntervalSeconds: 99999 }).minIntervalSeconds, 3600)
})

test('群目标选择：总开关、事件开关、平台开关三重过滤，任一不满足即不投递', () => {
  const base = {
    astrbotEnabled: true,
    astrbotBroadcastEnabled: true,
    astrbotPlatforms: platforms,
    astrbotGroupEvents: { songRequest: true, registrationPending: true, backupFailed: false }
  }
  assert.deepEqual(selectAstrbotGroupTargets([
    { umo: groupUmo, platform: 'qq' },
    { umo: 'default:GroupMessage:2', platform: 'dingtalk' },
    { umo: 'default:GroupMessage:3', platform: 'wecom' }
  ], base, 'songRequest'), [groupUmo, 'default:GroupMessage:3'])

  // 事件开关关闭：该事件不得投递任何群。
  assert.deepEqual(selectAstrbotGroupTargets([{ umo: groupUmo, platform: 'qq' }], base, 'backupFailed'), [])
  // 总开关关闭。
  assert.deepEqual(selectAstrbotGroupTargets([{ umo: groupUmo, platform: 'qq' }],
    { ...base, astrbotBroadcastEnabled: false }, 'songRequest'), [])
  // 群推送总开关未启用时即使平台开启也不投递。
  assert.deepEqual(selectAstrbotGroupTargets([{ umo: groupUmo, platform: 'qq' }],
    { ...base, astrbotEnabled: false }, 'songRequest'), [])
  // 平台被关掉后该平台的目标被剔除。
  assert.deepEqual(selectAstrbotGroupTargets([{ umo: 'default:GroupMessage:3', platform: 'wecom' }],
    { ...base, astrbotPlatforms: { ...platforms, wecom: false } }, 'songRequest'), [])
})

test('投递前复核：白名单外的群一律拒绝，平台关掉也拒绝', () => {
  const targets = [{ umo: groupUmo, platform: 'qq' }]
  assert.equal(isAstrbotGroupTargetAllowed(targets, platforms, groupUmo), true)
  assert.equal(isAstrbotGroupTargetAllowed(targets, platforms, 'default:GroupMessage:999'), false)
  assert.equal(isAstrbotGroupTargetAllowed(targets, { ...platforms, qq: false }, groupUmo), false)
  assert.equal(isAstrbotGroupTargetAllowed(targets, platforms, 'default:FriendMessage:1'), false)
  assert.equal(isAstrbotGroupTargetAllowed(null, platforms, groupUmo), false)
})

test('合并正文：追加换行，超长截断并保留提示', () => {
  assert.equal(appendAstrbotGroupContent('A 点了《歌一》', 'B 点了《歌二》'), 'A 点了《歌一》\nB 点了《歌二》')
  assert.equal(appendAstrbotGroupContent('', 'B 点了《歌二》'), 'B 点了《歌二》')
  const long = appendAstrbotGroupContent('x'.repeat(2900), 'y'.repeat(500))
  assert.ok(long.length <= 3000)
  assert.ok(long.endsWith('…（内容过多，已省略部分）'))
})

test('防抖语义：冷却从最后一次事件起算，但最多等到合并窗口上限', () => {
  const throttle = { mergeWindowSeconds: 300, minIntervalSeconds: 60 }
  const createdAt = new Date('2026-09-26T00:00:00Z')

  // 首条事件：等 minIntervalSeconds 后发出。
  assert.equal(computeAstrbotGroupNotifyAfter(createdAt, createdAt, throttle).toISOString(),
    '2026-09-26T00:01:00.000Z')

  // 冷却期内又来一条：闸门顺延到这条之后。
  const second = new Date('2026-09-26T00:00:30Z')
  assert.equal(computeAstrbotGroupNotifyAfter(createdAt, second, throttle).toISOString(),
    '2026-09-26T00:01:30.000Z')

  // 持续来事件时不得无限顺延：上限是首条事件 + 合并窗口。
  const late = new Date('2026-09-26T00:04:50Z')
  assert.equal(computeAstrbotGroupNotifyAfter(createdAt, late, throttle).toISOString(),
    '2026-09-26T00:05:00.000Z')

  // 超过上限后到达的事件按上限立即发出，不再推迟。
  const beyond = new Date('2026-09-26T00:10:00Z')
  assert.equal(computeAstrbotGroupNotifyAfter(createdAt, beyond, throttle).toISOString(),
    '2026-09-26T00:05:00.000Z')
})

test('可合并判定：已投递、已失败、被领取中的条目都不再承接新事件', () => {
  const throttle = { mergeWindowSeconds: 300, minIntervalSeconds: 60 }
  const now = new Date('2026-09-26T00:01:00Z')
  const createdAt = new Date('2026-09-26T00:00:00Z')

  assert.equal(canMergeAstrbotGroupEvent({ createdAt }, now, throttle), true)
  // 超过合并窗口：另起一条，避免老条目被无限追加。
  assert.equal(canMergeAstrbotGroupEvent({ createdAt }, new Date('2026-09-26T00:06:00Z'), throttle), false)
  assert.equal(canMergeAstrbotGroupEvent({ createdAt, deliveredAt: now }, now, throttle), false)
  assert.equal(canMergeAstrbotGroupEvent({ createdAt, failedAt: now }, now, throttle), false)
  // 已被领取（租约未过期）：不能改正文，否则投递内容与已读内容不一致。
  assert.equal(canMergeAstrbotGroupEvent({ createdAt, leasedUntil: new Date('2026-09-26T00:02:00Z') }, now, throttle), false)
  assert.equal(canMergeAstrbotGroupEvent({ createdAt, leasedUntil: new Date('2026-09-26T00:00:30Z') }, now, throttle), true)
})
