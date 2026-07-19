import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isAllowedDuringPasswordChange,
  isPublicApiPath,
  shouldBypassPublicApiAuthentication
} from '../../server/utils/auth-route-policy.ts'

test('匿名用户可以访问公共接口', () => {
  assert.equal(isPublicApiPath('/api/songs/public'), true)
  assert.equal(shouldBypassPublicApiAuthentication('/api/songs/public', false), true)
})

test('携带登录态访问公共接口时必须经过认证检查', () => {
  assert.equal(shouldBypassPublicApiAuthentication('/api/songs/public', true), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/site-config', true), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/proxy/image', true), false)
})

test('受保护接口不能绕过认证', () => {
  assert.equal(shouldBypassPublicApiAuthentication('/api/admin/users', false), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/admin/users', true), false)
})

test('强制改密期间只放行必要的认证接口', () => {
  assert.equal(isAllowedDuringPasswordChange('/api/auth/change-password'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/set-initial-password'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/logout'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/songs/public'), false)
  assert.equal(isAllowedDuringPasswordChange('/api/admin/system-settings'), false)
})
