import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveNotificationBatchReference,
  resolveNotificationHistoryFilters,
  resolveNotificationHistoryPagination,
  resolveNotificationHistoryStatus
} from '../../server/utils/notification-history-policy.ts'

test('通知发送历史支持关键词、类型、发送人和时间排序筛选', () => {
  assert.deepEqual(
    resolveNotificationHistoryFilters({
      keyword: '  放假通知  ',
      type: 'important',
      sender: '7',
      sortOrder: 'asc'
    }),
    {
      keyword: '放假通知',
      type: 'IMPORTANT',
      senderId: 7,
      sortOrder: 'ASC'
    }
  )
  assert.deepEqual(resolveNotificationHistoryFilters({}), {
    keyword: '',
    type: 'ALL',
    senderId: null,
    sortOrder: 'DESC'
  })
})

test('通知发送历史拒绝无效筛选参数', () => {
  assert.equal(resolveNotificationHistoryFilters({ keyword: ['通知'] }), null)
  assert.equal(resolveNotificationHistoryFilters({ keyword: 'a'.repeat(101) }), null)
  assert.equal(resolveNotificationHistoryFilters({ type: 'SYSTEM' }), null)
  assert.equal(resolveNotificationHistoryFilters({ sender: '0' }), null)
  assert.equal(resolveNotificationHistoryFilters({ sender: 'admin' }), null)
  assert.equal(resolveNotificationHistoryFilters({ sortOrder: 'latest' }), null)
})

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

test('通知批次引用支持新批次和历史单条记录', () => {
  assert.deepEqual(resolveNotificationBatchReference('550E8400-E29B-41D4-A716-446655440000'), {
    batchId: '550e8400-e29b-41d4-a716-446655440000',
    notificationId: null
  })
  assert.deepEqual(resolveNotificationBatchReference('legacy-42'), {
    batchId: null,
    notificationId: 42
  })
})

test('通知批次引用拒绝无效值', () => {
  assert.equal(resolveNotificationBatchReference('legacy-0'), null)
  assert.equal(
    resolveNotificationBatchReference('legacy-group-550e8400e29b41d4a716446655440000'),
    null
  )
  assert.equal(resolveNotificationBatchReference('not-a-batch'), null)
  assert.equal(resolveNotificationBatchReference(undefined), null)
})
