import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ARCHIVED_USER_STATUSES,
  isArchivedStatus,
  resolveArchivedFilter
} from '../../app/utils/user-archive.ts'

test('归档状态包含 graduate（限制访问-毕业生）与 withdrawn（限制访问-退学）', () => {
  assert.deepEqual([...ARCHIVED_USER_STATUSES], ['graduate', 'withdrawn'])
})

test('isArchivedStatus 识别归档状态', () => {
  assert.equal(isArchivedStatus('graduate'), true)
  assert.equal(isArchivedStatus('withdrawn'), true)
  assert.equal(isArchivedStatus('active'), false)
  assert.equal(isArchivedStatus('pending'), false)
  assert.equal(isArchivedStatus(null), false)
  assert.equal(isArchivedStatus(undefined), false)
})

test('archived=1 解析为仅查已归档', () => {
  assert.equal(resolveArchivedFilter('1'), 'archived')
  assert.equal(resolveArchivedFilter('true'), 'archived')
})

test('archived=0 解析为排除已归档', () => {
  assert.equal(resolveArchivedFilter('0'), 'unarchived')
  assert.equal(resolveArchivedFilter('false'), 'unarchived')
})

test('缺省或未知值不限制归档', () => {
  assert.equal(resolveArchivedFilter(undefined), 'all')
  assert.equal(resolveArchivedFilter(''), 'all')
  assert.equal(resolveArchivedFilter('yes'), 'all')
})

test('数组参数取首项解析', () => {
  assert.equal(resolveArchivedFilter(['1']), 'archived')
  assert.equal(resolveArchivedFilter(['0']), 'unarchived')
})
