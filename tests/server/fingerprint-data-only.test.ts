import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { isPublicApiPath, shouldBypassPublicApiAuthentication } from '../../server/utils/auth-route-policy.ts'
import { serverErrors } from '../../app/utils/locale/zh-CN.ts'
import { serverErrors as enServerErrors } from '../../app/utils/locale/en-US.ts'

const newDir = new URL('../../server/api/user/fingerprint/', import.meta.url)
const oldDir = new URL('../../server/api/auth/fingerprint/', import.meta.url)

test('浏览器指纹登录端点已移除', () => {
  assert.equal(existsSync(oldDir), false, 'server/api/auth/fingerprint 目录应已删除')
  assert.equal(
    existsSync(new URL('login.post.ts', oldDir)),
    false,
    '指纹登录端点不应存在'
  )
  assert.equal(
    existsSync(new URL('check.get.ts', oldDir)),
    false,
    '登录页指纹预检端点不应存在'
  )
})

test('指纹登录相关路由不再匿名放行', () => {
  assert.equal(isPublicApiPath('/api/auth/fingerprint/login', 'POST'), false)
  assert.equal(isPublicApiPath('/api/auth/fingerprint/check', 'GET'), false)
  assert.equal(
    shouldBypassPublicApiAuthentication('/api/auth/fingerprint/login', 'POST', false),
    false
  )
  assert.equal(
    shouldBypassPublicApiAuthentication('/api/auth/fingerprint/check', 'GET', false),
    false
  )
})

test('指纹数据接口位于用户域且全部需要登录态', () => {
  assert.equal(existsSync(new URL('preference.get.ts', newDir)), true)
  assert.equal(existsSync(new URL('preference.post.ts', newDir)), true)
  assert.equal(existsSync(new URL('enable.post.ts', newDir)), true)
  assert.equal(existsSync(new URL('list.get.ts', newDir)), true)
  assert.equal(existsSync(new URL('[id].delete.ts', newDir)), true)

  for (const [path, method] of [
    ['/api/user/fingerprint/preference', 'GET'],
    ['/api/user/fingerprint/preference', 'POST'],
    ['/api/user/fingerprint/enable', 'POST'],
    ['/api/user/fingerprint/list', 'GET'],
    ['/api/user/fingerprint/1', 'DELETE']
  ] as const) {
    assert.equal(isPublicApiPath(path, method), false, `${path} 不应匿名放行`)
  }
})

test('服务端错误码不再包含指纹登录专用错误码', () => {
  assert.equal(
    'AUTH_FINGERPRINT_NOT_BOUND' in serverErrors,
    false,
    '指纹登录专用错误码应移除'
  )
  assert.equal('AUTH_FINGERPRINT_NOT_BOUND' in enServerErrors, false)
  // 保留下来的错误码需中英双语齐备
  for (const code of [
    'AUTH_FINGERPRINT_INVALID',
    'AUTH_FINGERPRINT_DISABLED',
    'AUTH_FINGERPRINT_BOUND_TO_OTHER',
    'AUTH_FINGERPRINT_LIMIT_EXCEEDED',
    'AUTH_FINGERPRINT_NOT_FOUND'
  ] as const) {
    assert.equal(code in serverErrors, true, `zh 缺少 ${code}`)
    assert.equal(code in enServerErrors, true, `en 缺少 ${code}`)
  }
})
