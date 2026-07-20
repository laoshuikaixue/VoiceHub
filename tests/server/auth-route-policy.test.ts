import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isAllowedDuringPasswordChange,
  isPublicApiPath,
  shouldBlockDuringPasswordChange,
  shouldBypassPublicApiAuthentication
} from '../../server/utils/auth-route-policy.ts'

test('匿名用户可以访问公共接口', () => {
  assert.equal(isPublicApiPath('/api/songs/public', 'GET'), true)
  assert.equal(shouldBypassPublicApiAuthentication('/api/songs/public', 'GET', false), true)
})

test('携带登录态访问公共接口时必须经过认证检查', () => {
  assert.equal(shouldBypassPublicApiAuthentication('/api/songs/public', 'GET', true), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/site-config', 'GET', true), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/proxy/image', 'GET', true), false)
})

test('受保护接口不能绕过认证', () => {
  assert.equal(shouldBypassPublicApiAuthentication('/api/admin/users', 'GET', false), false)
  assert.equal(shouldBypassPublicApiAuthentication('/api/admin/users', 'GET', true), false)
})

test('强制改密期间只放行必要的认证接口', () => {
  assert.equal(isAllowedDuringPasswordChange('/api/auth/change-password', 'POST'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/set-initial-password', 'POST'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/logout', 'POST'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/site-config', 'GET'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/songs/public', 'GET'), false)
  assert.equal(isAllowedDuringPasswordChange('/api/admin/system-settings', 'GET'), false)
})

test('公共 API 路径匹配不会接受相似但未注册的路径', () => {
  assert.equal(isPublicApiPath('/api/auth/loginX', 'POST'), false)
  assert.equal(isPublicApiPath('/api/site-config.evil', 'GET'), false)
  assert.equal(isPublicApiPath('/api/site-config/extra', 'GET'), false)
  assert.equal(isPublicApiPath('/api/auth/webauthn/login/options', 'POST'), true)
  assert.equal(isAllowedDuringPasswordChange('/api/auth/change-passwordX', 'POST'), false)
})

test('公共 API 只放行已注册的 HTTP 方法', () => {
  assert.equal(isPublicApiPath('/api/auth/login', 'POST'), true)
  assert.equal(isPublicApiPath('/api/auth/login', 'GET'), false)
  assert.equal(isPublicApiPath('/api/site-config', 'GET'), true)
  assert.equal(isPublicApiPath('/api/site-config', 'POST'), false)
  assert.equal(isPublicApiPath('/api/music/state', 'POST'), false)
})

test('强制改密门控放行公共 API，但阻止业务写入和 OAuth 绑定', () => {
  assert.equal(shouldBlockDuringPasswordChange('/api/site-config', 'GET', true), false)
  assert.equal(shouldBlockDuringPasswordChange('/api/sys/time', 'GET', true), false)
  assert.equal(shouldBlockDuringPasswordChange('/api/music/state', 'POST', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/auth/github', 'GET', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/auth/github/callback', 'GET', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/admin/users', 'GET', true), true)
  assert.equal(shouldBlockDuringPasswordChange('/api/admin/users', 'GET', false), false)
})
