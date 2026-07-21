import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canSetInitialPassword,
  getPasswordSetupState
} from '../../server/utils/initial-password-policy.ts'

test('历史有密码用户应进入普通改密流程', () => {
  assert.deepEqual(
    getPasswordSetupState(
      { password: 'existing-hash', passwordChangedAt: null },
      false
    ),
    { hasSetPassword: true, needsInitialPasswordSetup: false }
  )
})

test('首次强制改密用户应进入初始设置流程', () => {
  assert.deepEqual(
    getPasswordSetupState(
      { password: 'temporary-hash', passwordChangedAt: null },
      true
    ),
    { hasSetPassword: true, needsInitialPasswordSetup: true }
  )
})

test('无密码 OAuth 用户应进入初始设置流程', () => {
  assert.deepEqual(
    getPasswordSetupState(
      { password: null, passwordChangedAt: null },
      false
    ),
    { hasSetPassword: false, needsInitialPasswordSetup: true }
  )
})

test('已完成密码设置的用户应进入普通改密流程', () => {
  assert.deepEqual(
    getPasswordSetupState(
      { password: 'existing-hash', passwordChangedAt: new Date() },
      true
    ),
    { hasSetPassword: true, needsInitialPasswordSetup: false }
  )
})

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
