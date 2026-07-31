import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canSendSystemNotification,
  createNotificationSenderSnapshot,
  createNotificationReadUpdate,
  createNotificationUserDeleteUpdate,
  resolveImportantFlag,
  resolveNotificationSource,
  shouldCheckImportantNotification,
  shouldDeliverSystemNotification,
  shouldRetainNotificationHistory,
  serializeNotificationSender
} from '../../server/utils/important-notification-policy.ts'

test('未登录、无用户或强制改密时不检查重要通知', () => {
  assert.equal(shouldCheckImportantNotification(false, null), false)
  assert.equal(shouldCheckImportantNotification(true, null), false)
  assert.equal(shouldCheckImportantNotification(true, 1, true), false)
  assert.equal(shouldCheckImportantNotification(true, 1), true)
})

test('关闭通知使用服务端已读更新并刷新更新时间', () => {
  const updatedAt = new Date('2026-07-29T12:00:00.000Z')
  assert.deepEqual(createNotificationReadUpdate(updatedAt), { read: true, updatedAt })
})

test('用户删除通知时保留记录并同步标记为已读', () => {
  const updatedAt = new Date('2026-07-29T12:30:00.000Z')
  assert.deepEqual(createNotificationUserDeleteUpdate(updatedAt), {
    userDeleted: true,
    read: true,
    updatedAt
  })
})

test('重要通知绕过普通通知开关，普通通知保持原策略', () => {
  assert.equal(shouldDeliverSystemNotification(false, false), false)
  assert.equal(shouldDeliverSystemNotification(false, true), true)
  assert.equal(shouldDeliverSystemNotification(true, false), true)
})

test('只有后台手工发送的通知需要在用户删除后保留历史', () => {
  assert.equal(shouldRetainNotificationHistory('SYSTEM_NOTICE', 'ADMIN_MANUAL'), true)
  assert.equal(shouldRetainNotificationHistory('SYSTEM_NOTICE', 'SYSTEM'), false)
  assert.equal(shouldRetainNotificationHistory('SONG_PLAYED', 'SYSTEM'), false)
})

test('只有管理员角色可以发送系统通知', () => {
  assert.equal(canSendSystemNotification('ADMIN'), true)
  assert.equal(canSendSystemNotification('SUPER_ADMIN'), true)
  assert.equal(canSendSystemNotification('SONG_ADMIN'), false)
  assert.equal(canSendSystemNotification('USER'), false)
})

test('important 只接受布尔值，缺省值为 false', () => {
  assert.equal(resolveImportantFlag(undefined), false)
  assert.equal(resolveImportantFlag(true), true)
  assert.equal(resolveImportantFlag(false), false)
  assert.equal(resolveImportantFlag('true'), null)
  assert.equal(resolveImportantFlag(1), null)
})

test('系统通知不保存发送人，管理员通知保存发送时的名称快照', () => {
  const systemSender = createNotificationSenderSnapshot()
  assert.deepEqual(systemSender, {
    senderId: null,
    senderName: null,
    senderUsername: null
  })
  assert.equal(serializeNotificationSender(systemSender), null)
  assert.equal(resolveNotificationSource(null), 'SYSTEM')

  const adminSender = createNotificationSenderSnapshot({
    id: 7,
    name: ' 张老师 ',
    username: ' admin '
  })
  assert.deepEqual(adminSender, {
    senderId: 7,
    senderName: '张老师',
    senderUsername: 'admin'
  })
  assert.deepEqual(serializeNotificationSender(adminSender), {
    id: 7,
    name: '张老师',
    username: 'admin'
  })
  assert.equal(
    resolveNotificationSource({ id: 7, name: '张老师', username: 'admin' }),
    'ADMIN_MANUAL'
  )
})
