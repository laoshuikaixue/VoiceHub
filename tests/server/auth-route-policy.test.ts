import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isAllowedDuringPasswordChange,
  isPublicApiPath,
  shouldBlockDuringPasswordChange,
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
  assert.equal(isAllowedDuringPasswordChange('/api/site-config'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/songs/public'), false)
  assert.equal(isAllowedDuringPasswordChange('/api/admin/system-settings'), false)
})

test('公共 API 路径匹配不会接受相似但未注册的路径', () => {
  assert.equal(isPublicApiPath('/api/auth/loginX'), false)
  assert.equal(isPublicApiPath('/api/site-config.evil'), false)
  assert.equal(isPublicApiPath('/api/site-config/extra'), false)
  assert.equal(isPublicApiPath('/api/auth/webauthn/login/options'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/change-passwordX'), false)
})

test('强制改密门控放行公共 API，但不放行已有会话发起的 OAuth 路由', () => {
  assert.equal(shouldBlockDuringPasswordChange('/api/site-config', true), false)
  assert.equal(shouldBlockDuringPasswordChange('/api/sys/time', true), false)
  assert.equal(shouldBlockDuringPasswordChange('/api/auth/github', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/auth/github/callback', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/admin/users', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/admin/users', false), false)
})
