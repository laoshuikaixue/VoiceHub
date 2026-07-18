import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isAllowedDuringPasswordChange,
  isPublicApiPath,
  shouldBypassPublicApiAuthentication
} from '../../server/utils/auth-route-policy.ts'

test('匿名用户可以访问边缘公共接口', () => {
  assert.equal(isPublicApiPath('/api/songs/public'), true)
  assert.equal(shouldBypassPublicApiAuthentication('/api/songs/public', false), true)
})

test('携带登录态访问边缘公共接口时必须执行安全检查', () => {
  assert.equal(shouldBypassPublicApiAuthentication('/api/songs/public', true), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/site-config', true), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/proxy/image', true), false)
})

test('受保护接口始终不能绕过认证', () => {
  assert.equal(shouldBypassPublicApiAuthentication('/api/admin/users', false), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/admin/users', true), false)
})

test('强制改密期间仅放行改密和登录态维护接口', () => {
  assert.equal(isAllowedDuringPasswordChange('/api/auth/change-password'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/set-initial-password'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/2fa/verify'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/songs/public'), false)
  assert.equal(isAllowedDuringPasswordChange('/api/admin/system-settings'), false)
})
