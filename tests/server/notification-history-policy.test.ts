import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveNotificationHistoryPagination,
  resolveNotificationHistoryStatus
} from '../../server/utils/notification-history-policy.ts'

test('通知历史状态筛选支持全部、已读和未读', () => {
  assert.equal(resolveNotificationHistoryStatus(undefined), 'ALL')
  assert.equal(resolveNotificationHistoryStatus('read'), 'READ')
  assert.equal(resolveNotificationHistoryStatus(' UNREAD '), 'UNREAD')
})

test('通知历史状态筛选拒绝未知值和非字符串', () => {
  assert.equal(resolveNotificationHistoryStatus('ARCHIVED'), null)
  assert.equal(resolveNotificationHistoryStatus(true), null)
})

test('通知历史分页使用安全缺省值并限制最大页大小', () => {
  assert.deepEqual(resolveNotificationHistoryPagination(undefined, undefined), {
    page: 1,
    limit: 20,
    offset: 0
  })
  assert.deepEqual(resolveNotificationHistoryPagination('3', '500'), {
    page: 3,
    limit: 100,
    offset: 200
  })
  assert.deepEqual(resolveNotificationHistoryPagination('-1', '0'), {
    page: 1,
    limit: 20,
    offset: 0
  })
})
