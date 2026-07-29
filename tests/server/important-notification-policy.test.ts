import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canSendSystemNotification,
  createNotificationReadUpdate,
  resolveImportantFlag,
  selectNextImportantNotification,
  shouldCheckImportantNotification,
  shouldDeliverSystemNotification
} from '../../server/utils/important-notification-policy.ts'

const notice = (
  id: number,
  options: Partial<{ important: boolean; read: boolean; createdAt: string }> = {}
) => ({
  id,
  important: options.important ?? true,
  read: options.read ?? false,
  createdAt: options.createdAt ?? `2026-07-29T00:00:0${id}.000Z`
})

test('未登录、无用户或强制改密时不检查重要通知', () => {
  assert.equal(shouldCheckImportantNotification(false, null), false)
  assert.equal(shouldCheckImportantNotification(true, null), false)
  assert.equal(shouldCheckImportantNotification(true, 1, true), false)
  assert.equal(shouldCheckImportantNotification(true, 1), true)
})

test('仅未读重要通知进入全屏提醒队列', () => {
  const normal = notice(1, { important: false })
  const readImportant = notice(2, { read: true })
  const unreadImportant = notice(3)

  assert.equal(selectNextImportantNotification([normal]), null)
  assert.equal(selectNextImportantNotification([readImportant]), null)
  assert.equal(selectNextImportantNotification([normal, readImportant, unreadImportant])?.id, 3)
})

test('多条重要通知按创建时间和 ID 从旧到新逐条展示', () => {
  const sameTime = '2026-07-29T08:00:00.000Z'
  const selected = selectNextImportantNotification([
    notice(9, { createdAt: '2026-07-29T09:00:00.000Z' }),
    notice(7, { createdAt: sameTime }),
    notice(6, { createdAt: sameTime })
  ])

  assert.equal(selected?.id, 6)
})

test('旧通知已读后，新发送的重要通知仍会展示', () => {
  const selected = selectNextImportantNotification([
    notice(1, { read: true }),
    notice(2, { createdAt: '2026-07-29T10:00:00.000Z' })
  ])

  assert.equal(selected?.id, 2)
})

test('关闭通知使用服务端已读更新并刷新更新时间', () => {
  const updatedAt = new Date('2026-07-29T12:00:00.000Z')
  assert.deepEqual(createNotificationReadUpdate(updatedAt), { read: true, updatedAt })
})

test('重要通知绕过普通通知开关，普通通知保持原策略', () => {
  assert.equal(shouldDeliverSystemNotification(false, false), false)
  assert.equal(shouldDeliverSystemNotification(false, true), true)
  assert.equal(shouldDeliverSystemNotification(true, false), true)
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
