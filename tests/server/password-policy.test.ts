import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePasswordPolicy } from '../../app/utils/password-policy.ts'

test('密码策略接受包含三类字符的安全密码', () => {
  assert.equal(validatePasswordPolicy('StrongPass123'), null)
  assert.equal(validatePasswordPolicy('安全Pass123!'), null)
})

test('密码策略拒绝常见弱口令和字符类型不足的密码', () => {
  assert.match(validatePasswordPolicy('12345678') || '', /过于常见/)
  assert.match(validatePasswordPolicy('abcdefgh') || '', /三类/)
})

test('密码策略拒绝超过 bcrypt 有效字节长度的密码', () => {
  assert.match(validatePasswordPolicy('Aa1' + '!'.repeat(70)) || '', /72字节/)
})
