import assert from 'node:assert/strict'
import test from 'node:test'
import { canSetInitialPassword } from '../../server/utils/initial-password-policy.ts'

test('强制改密账号可以设置初始密码', () => {
  assert.equal(
    canSetInitialPassword(
      { requirePasswordChange: true },
      { password: 'existing-hash', passwordChangedAt: null }
    ),
    true
  )
})

test('真正无密码的账号可以设置初始密码', () => {
  assert.equal(
    canSetInitialPassword(
      { requirePasswordChange: false },
      { password: null, passwordChangedAt: null }
    ),
    true
  )
})

test('非强制状态的有密码账号不能免旧密码设置', () => {
  assert.equal(
    canSetInitialPassword(
      { requirePasswordChange: false },
      { password: 'existing-hash', passwordChangedAt: null }
    ),
    false
  )
})

test('已经完成密码设置的账号不能重复使用初始设置接口', () => {
  assert.equal(
    canSetInitialPassword(
      { requirePasswordChange: true },
      { password: 'existing-hash', passwordChangedAt: new Date() }
    ),
    false
  )
})
