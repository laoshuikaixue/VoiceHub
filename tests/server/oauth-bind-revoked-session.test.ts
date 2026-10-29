import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// OAuth 绑定与会话撤销：撤销只写 auth_sessions.revokedAt，不 bump tokenVersion，
// 因此自行读取原始 Cookie 的 OAuth 回调必须先认中间件的 authRejected 标记
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const CALLBACK = read('../../server/api/auth/[provider]/callback.get.ts')
const AUTH_MIDDLEWARE = read('../../server/middleware/auth.ts')
const AUTH_SESSION = read('../../server/utils/auth-session.ts')

test('会话撤销不改动 tokenVersion', () => {
  const revokeSource = AUTH_SESSION.match(/export async function revokeAuthSession[\s\S]*?\n\}/)?.[0] ?? ''
  const revokeOthersSource = AUTH_SESSION.match(/export async function revokeOtherAuthSessions[\s\S]*?\n\}/)?.[0] ?? ''
  assert.ok(revokeSource && revokeOthersSource, '撤销函数缺失')
  assert.doesNotMatch(revokeSource, /tokenVersion/, '单设备登出不该 bump 用户级版本号')
  assert.doesNotMatch(revokeOthersSource, /tokenVersion/, '移除其他设备只写 revokedAt')
})

test('OAuth 回调对被降级的登录态不再读取原始 Cookie', () => {
  assert.match(
    CALLBACK,
    /event\.context\.authRejected \? null : getCookie\(event, 'auth-token'\)/,
    '绑定模式必须以中间件的撤销判定为准'
  )
  // 绑定事务只比对 tokenVersion，缺了会话判定就会接受已撤销的令牌
  const bindBranch = CALLBACK.match(/\/\/ 4\. 检查是否已登录[\s\S]*?const existingIdentity/)?.[0] ?? ''
  assert.doesNotMatch(bindBranch, /^\s*const authToken = getCookie/m, '不得无条件读取 Cookie')
})

test('中间件对失效会话与降级请求统一标记 authRejected', () => {
  assert.match(AUTH_MIDDLEWARE, /authSession\.revokedAt/, '会话撤销必须在中间件判定')
  const degrade = AUTH_MIDDLEWARE.match(/const degradeToAnonymous[\s\S]*?\n {2}\}/)?.[0] ?? ''
  assert.ok(degrade, '降级函数缺失')
  assert.match(degrade, /event\.context\.authRejected = true/, '降级必须置标记，否则下游无从得知')
})
