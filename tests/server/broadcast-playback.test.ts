import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, compileTemplate } from 'vue/compiler-sfc'
import { canUseAdminPage, hasPermission } from '../../app/utils/admin-permissions.ts'
import { summarizeScheduleDuration, estimateBroadcastDuration } from '../../app/utils/schedule-duration.ts'
import { admin as zhAdmin, serverErrors as zhErrors } from '../../app/utils/locale/zh-CN.ts'
import { admin as enAdmin, serverErrors as enErrors } from '../../app/utils/locale/en-US.ts'
import { resolveAdminRouteGuard } from '../../server/utils/admin-permission-routes.ts'

test('歌单汇总单独统计缺失时长，而估算遵循正在播放的曲目及结束策略', () => {
  assert.deepEqual(summarizeScheduleDuration([{ song: { durationSeconds: 60 } }, { song: { durationSeconds: 0 } }, { song: {} }]), {
    seconds: 60, unknown: 2
  })
  assert.equal(estimateBroadcastDuration([60, 90], 10, 70, false, false), 140)
  assert.equal(estimateBroadcastDuration([60, 90], 10, 70, false, true), 70)
  assert.equal(estimateBroadcastDuration([60, 90], 10, 50, false, false), 50)
  assert.equal(estimateBroadcastDuration([60, 90], 10, -10, true, false), 50)
  assert.equal(estimateBroadcastDuration([60, null], 10, 70, false, false), null)
})

test('发布预检要求排期写入权限，双语确认文案就绪', () => {
  const guard = resolveAdminRouteGuard('/api/admin/schedule/publish-context', 'GET')
  assert.deepEqual(guard?.any, ['schedule:write'])
  for (const { confirmations } of [zhAdmin.scheduleManager, enAdmin.scheduleManager]) {
    assert.ok(confirmations.autoBroadcastWarning)
    assert.match(confirmations.unattendedAccount('qa-controller'), /qa-controller/)
    assert.ok(confirmations.unattendedAccountOffline)
  }
  assert.ok(zhErrors.SCHEDULE_BROADCAST_CONFIRMATION_REQUIRED)
  assert.ok(enErrors.SCHEDULE_BROADCAST_CONFIRMATION_REQUIRED)
})

test('播放控制权限区分查看、操作、设置和标记，并遵循显式拒绝', () => {
  const entry = 'priv:admin-console'
  assert.equal(canUseAdminPage([entry, 'page:playback'], 'playback'), false)
  assert.equal(canUseAdminPage([entry, 'playback:read'], 'playback'), true)
  assert.equal(canUseAdminPage([entry, 'playback:control'], 'playback'), true)
  assert.equal(canUseAdminPage([entry, 'playback:control', '!playback:read'], 'playback'), false)
  assert.equal(canUseAdminPage([entry, 'playback:control', '!page:playback'], 'playback'), false)
  assert.equal(hasPermission([entry, 'playback:control'], 'playback:mark-played'), false)
  assert.equal(hasPermission([entry, 'playback:configure'], 'playback:control'), false)
  assert.equal(hasPermission([entry, 'playback:*', '!playback:configure'], 'playback:configure'), false)
})

test('播放控制模板可编译且页面文案双语键同步', () => {
  const filename = 'app/components/Admin/BroadcastPlayback.vue'
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  assert.deepEqual(compileTemplate({ source: descriptor.template!.content, filename, id: 'broadcast' }).errors, [])
  assert.deepEqual(Object.keys(zhAdmin.broadcastPlayback), Object.keys(enAdmin.broadcastPlayback))
  const auditActions = ['playback.unattended-enable', 'playback.unattended-disable', 'playback.auto-start', 'playback.auto-end']
  assert.deepEqual(Object.keys(zhAdmin.auditLog.actionLabels), auditActions)
  assert.deepEqual(Object.keys(enAdmin.auditLog.actionLabels), auditActions)
  for (const code of ['BROADCAST_ACCESS', 'BROADCAST_BUSY', 'BROADCAST_UNAVAILABLE'] as const) {
    assert.ok(zhErrors[code]); assert.ok(enErrors[code])
  }
})
