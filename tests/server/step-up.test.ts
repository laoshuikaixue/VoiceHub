import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { SERVER_ERROR_CODES } from '../../server/config/constants.ts'

// 与 captchaStore.hashStateCode 同构的替身：同 key 稳定、异 key 不同
const hashStateCode = (scope: string, value: string) =>
  createHmac('sha256', 'test-secret').update(`${scope}:${value}`).digest('hex')

const createApiError = (statusCode: number, code: string, message: string, data?: unknown) =>
  Object.assign(new Error(message), { statusCode, data: { code, ...(data as object) } })

function runtime() {
  const store = new Map<string, { value: string; ttl: number }>()
  const source = stripTypeScriptTypes(
    readFileSync(new URL('../../server/utils/step-up.ts', import.meta.url), 'utf8')
  )
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace(/\bexport /g, '')
  const stepUp = new Function(
    'setStore',
    'getStore',
    'delStore',
    'hashStateCode',
    'createApiError',
    'SERVER_ERROR_CODES',
    `${source}; return { STEP_UP_REASONS, isStepUpReason, stepUpTtl, issueStepUpWindow, hasStepUpWindow, requireStepUp, clearStepUpWindow }`
  )(
    async (key: string, value: string, ttl: number) => {
      store.set(key, { value, ttl })
    },
    async (key: string) => store.get(key)?.value ?? null,
    async (key: string) => {
      store.delete(key)
    },
    hashStateCode,
    createApiError,
    SERVER_ERROR_CODES
  )
  const event = (id: number, sessionId: string) => ({ context: { user: { id, sessionId } } })
  return { ...stepUp, event, store }
}

test('step-up 场景为封闭白名单', () => {
  const r = runtime()
  assert.deepEqual(Object.keys(r.STEP_UP_REASONS), ['super-admin-role'])
  assert.equal(r.isStepUpReason('super-admin-role'), true)
  for (const reason of ['backup-restore', 'database-reset', '', 'SUPER-ADMIN-ROLE']) {
    assert.equal(r.isStepUpReason(reason), false, `${reason} 不应被接受`)
  }
  assert.equal(r.stepUpTtl('super-admin-role'), 300)
})

test('验证窗口只对同用户同会话同场景生效', async () => {
  const r = runtime()
  const self = r.event(1, 'session-a')
  assert.equal(await r.hasStepUpWindow(self, 'super-admin-role'), false)

  assert.equal(await r.issueStepUpWindow(self, 'super-admin-role'), 300)
  await r.requireStepUp(self, 'super-admin-role')
  assert.equal(await r.hasStepUpWindow(self, 'super-admin-role'), true)

  // 换会话、换用户、换场景都不继承该窗口
  assert.equal(await r.hasStepUpWindow(r.event(1, 'session-b'), 'super-admin-role'), false)
  assert.equal(await r.hasStepUpWindow(r.event(2, 'session-a'), 'super-admin-role'), false)

  await r.clearStepUpWindow(self, 'super-admin-role')
  assert.equal(await r.hasStepUpWindow(self, 'super-admin-role'), false)
})

test('窗口缺失或存储值被伪造时返回 403，不触发登录失效登出', async () => {
  const r = runtime()
  const self = r.event(1, 'session-a')

  await assert.rejects(
    r.requireStepUp(self, 'super-admin-role'),
    { statusCode: 403, data: { code: SERVER_ERROR_CODES.PERMISSION_STEP_UP_REQUIRED } }
  )

  await r.issueStepUpWindow(self, 'super-admin-role')
  // 攻击者写入任意内容也无法满足 HMAC 指纹
  for (const key of r.store.keys()) r.store.set(key, { value: 'forged', ttl: 300 })
  assert.equal(await r.hasStepUpWindow(self, 'super-admin-role'), false)
})
