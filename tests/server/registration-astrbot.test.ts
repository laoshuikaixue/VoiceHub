import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ASTRBOT_PAYLOAD_MAX_BYTES,
  astrbotPayloadBytes,
  chunkAstrbotTargets,
  fitsAstrbotPayload
} from '../../server/utils/astrbot-payload.ts'

const registration = readFileSync(new URL('../../server/utils/registration-notify.ts', import.meta.url), 'utf8')
const approval = readFileSync(new URL('../../server/api/admin/users/[id]/approval.post.ts', import.meta.url), 'utf8')
const passwordRegistration = readFileSync(new URL('../../server/api/auth/register.post.ts', import.meta.url), 'utf8')
const oauthRegistration = readFileSync(new URL('../../server/api/auth/oauth-register.post.ts', import.meta.url), 'utf8')
const notifications = readFileSync(new URL('../../server/services/notificationService.ts', import.meta.url), 'utf8')

test('两种注册入口在 serverless 请求内等待待审通知', () => {
  assert.match(passwordRegistration, /await notifyRegistration\(/)
  assert.match(oauthRegistration, /await notifyRegistration\(/)
})

test('待审核注册通知选取管理员并通过批量站内通知转发 AstrBot', () => {
  assert.match(registration, /inArray\(users\.role, \['ADMIN', 'SUPER_ADMIN'\]\)/)
  assert.match(registration, /if \(requiresApproval\)\s*\{[\s\S]*?createBatchSystemNotifications\(/)
  assert.match(notifications, /sendBatchAstrbotNotifications\(/)
  assert.doesNotMatch(registration, /sendAstrbotNotificationToUser\(userId/)
  // 待审通知必须走广播为 false 的批量路径，绝不触发群广播。
  assert.match(registration, /createBatchSystemNotifications\(\s*adminIds,[\s\S]*?false\s*\)/)
})

test('审核结果不向申请人发送 AstrBot，原有邮件路径保留', () => {
  assert.doesNotMatch(approval, /postAstrbotNotification|sendAstrbotNotificationToUser/)
  assert.match(approval, /await notifyApproved\(/)
  assert.match(approval, /await notifyRejected\(/)
  assert.match(approval, /'register-approved'/)
  assert.match(approval, /'register-rejected'/)
})

test('正文按 UTF-8 字节数计算大小，超限时判定为不可发送', () => {
  // 多字节字符必须按真实字节数计算，否则会算小请求体并撞上插件的 413。
  const ascii = 'a'.repeat(1000)
  const emoji = '😀'.repeat(1000)
  assert.equal(Buffer.byteLength(emoji), 4000)
  assert.ok(astrbotPayloadBytes([], '', emoji) > astrbotPayloadBytes([], '', ascii))

  const huge = '😀'.repeat(20000)
  assert.equal(fitsAstrbotPayload([], '', huge), false)
  assert.equal(astrbotPayloadBytes([], '', huge) > ASTRBOT_PAYLOAD_MAX_BYTES, true)
  assert.equal(fitsAstrbotPayload([], '', 'ok'), true)
})

test('真实大正文驱动分块：每块都在插件限制内且不丢目标', () => {
  const umos = Array.from({ length: 250 }, (_, i) => `aiocqhttp:FriendMessage:user${i}`)
  // 正文足够大，使每块只能容纳少量目标，从而触发多块切分。
  const content = '通'.repeat(18000)
  const { chunks, skipped } = chunkAstrbotTargets(umos, '标题', content)
  assert.equal(skipped, 0)
  assert.ok(chunks.length > 1, `期望多块切分，实际 ${chunks.length} 块`)
  assert.deepEqual(chunks.flat(), umos, '分块不得丢失或重排目标')
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 200)
    assert.equal(fitsAstrbotPayload(chunk, '标题', content), true)
  }

  // 单目标即超限时计入 failures，不得静默丢弃。
  const oversized = chunkAstrbotTargets(['aiocqhttp:FriendMessage:user1'], '标题', '😀'.repeat(20000))
  assert.deepEqual(oversized.chunks, [])
  assert.equal(oversized.skipped, 1)
})

test('分块同时受 200 目标上限约束', () => {
  const umos = Array.from({ length: 401 }, (_, i) => `aiocqhttp:FriendMessage:u${i}`)
  const { chunks, skipped } = chunkAstrbotTargets(umos, 't', 'c')
  assert.equal(skipped, 0)
  assert.deepEqual(chunks.map((chunk) => chunk.length), [200, 200, 1])
  assert.deepEqual(chunks.flat(), umos)
})

test('正文超限时计入失败而非静默跳过', () => {
  const service = readFileSync(new URL('../../server/services/astrbotNotificationService.ts', import.meta.url), 'utf8')
  // 不再抛异常让上层吞掉；改为返回失败计数并记录日志。
  assert.doesNotMatch(service, /throw new Error\('通知正文超过 AstrBot 推送大小限制'\)/)
  assert.match(service, /failed: Math\.max\(umos\.length, 1\)/)
  // 超限正文确实无法容纳任何目标。
  const tooLong = '😀'.repeat(20000)
  assert.equal(fitsAstrbotPayload([], '', tooLong), false)
})
