import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getInitialPasswordPolicyViolation,
  validateInitialPasswordPolicy,
  validatePasswordPolicy
} from '../../app/utils/password-policy.ts'

test('密码策略接受包含三类字符的安全密码', () => {
  assert.equal(validatePasswordPolicy('StrongPass123'), null)
  assert.equal(validatePasswordPolicy('安全Pass123!'), null)
})

test('密码策略允许6位以上的安全密码', () => {
  assert.equal(validatePasswordPolicy('Pass12'), null)
})

test('密码策略拒绝少于6位的密码', () => {
  assert.match(validatePasswordPolicy('Pas12') || '', /长度至少为6位/)
})

test('密码策略拒绝常见弱口令和字符类型不足的密码', () => {
  assert.match(validatePasswordPolicy('12345678') || '', /过于常见/)
  assert.match(validatePasswordPolicy('abcdefgh') || '', /三类/)
})

test('密码策略拒绝超过 bcrypt 有效字节长度的密码', () => {
  assert.match(validatePasswordPolicy('Aa1' + '!'.repeat(70)) || '', /72字节/)
})

test('初始密码策略接受6位以上且包含两类字符的密码', () => {
  assert.equal(validateInitialPasswordPolicy('abcdef7'), null)
  assert.equal(validateInitialPasswordPolicy('ABCDEF1'), null)
  assert.equal(validateInitialPasswordPolicy('abcdefg!'), null)
  assert.equal(validateInitialPasswordPolicy('abcde1'), null)
})

test('初始密码策略拒绝不足6位的密码', () => {
  const violation = getInitialPasswordPolicyViolation('Pas12')
  assert.equal(violation?.code, 'AUTH_PASSWORD_TOO_SHORT')
  assert.match(violation?.message || '', /至少为6位/)
})

test('初始密码策略拒绝仅包含一类字符的密码', () => {
  const violation = getInitialPasswordPolicyViolation('abcdefg')
  assert.equal(violation?.code, 'AUTH_INITIAL_PASSWORD_COMPLEXITY_REQUIRED')
  assert.match(violation?.message || '', /两类/)
})
