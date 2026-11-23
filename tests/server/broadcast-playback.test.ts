import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
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
  assert.equal(canUseAdminPage([entry, 'playback:emergency-stop'], 'playback'), true)
  assert.equal(hasPermission([entry, 'playback:emergency-stop'], 'playback:remote-disarm'), false)
  assert.equal(hasPermission([entry, 'playback:control'], 'playback:emergency-stop'), false)
  assert.deepEqual(resolveAdminRouteGuard('/api/admin/playback/remote', 'POST')?.any,
    ['playback:remote-disarm', 'playback:emergency-stop'])
})

test('远程关闭核对值守目标并保留播出，紧急停播清除当前场次', async () => {
  const source = readFileSync('server/services/broadcastPlayback.ts', 'utf8')
  const start = source.indexOf('function unattendedTarget')
  const end = source.indexOf('export async function readScheduleBroadcastContext')
  const plain = source.slice(start, end)
    .replace('lease: Lease', 'lease')
    .replace(/^export type RemoteBroadcastCommand.*$/m, '')
    .replace('export async function commandRemoteBroadcast(command: RemoteBroadcastCommand)', 'async function commandRemoteBroadcast(command)')
  const createFixture = new Function('createHash', 'lease', `
    const writes = [], locks = []
    const now = new Date('2026-11-23T10:00:00Z')
    const tx = { update: () => ({ set: patch => ({ where: async () => { writes.push(patch) } }) }),
      query: { broadcastPlayback: { findFirst: async () => lease } } }
    const db = { transaction: callback => callback(tx) }
    const lockBroadcast = async () => { locks.push(true) }
    const getServerDate = () => now, readOnlineController = async () => ({ lease, username: 'operator' })
    const broadcastUnavailable = () => new Error('stale target')
    const broadcastPlayback = { id: 1 }, eq = () => true
    const emptyRun = { run: null, playDate: null, slotId: null, queue: null, cursor: 0 }
    ${plain}
    return { writes, locks, target: unattendedTarget(lease), commandRemoteBroadcast, now }
  `)
  const lease = { device: 'old', authSession: 'session', armedAt: new Date('2026-11-23T09:00:00Z'),
    run: 'active', slotId: 1, playDate: '2026-11-23' }
  const first = createFixture(createHash, lease)
  const second = createFixture(createHash, { ...lease, device: 'new' })
  await assert.rejects(second.commandRemoteBroadcast({ action: 'disarm', target: first.target }), /stale target/)
  assert.equal(second.writes.length, 0)
  assert.equal((await first.commandRemoteBroadcast({ action: 'disarm', target: first.target })).runId, 'active')
  assert.deepEqual(first.writes, [{ armedAt: null }])
  assert.equal((await first.commandRemoteBroadcast({ action: 'emergency-stop' })).runId, 'active')
  assert.deepEqual(first.writes[1], { run: null, playDate: null, slotId: null, queue: null, cursor: 0,
    armedAt: new Date(first.now.getTime() + 1) })
  assert.equal(first.locks.length, 2)
})

test('紧急停播在长按 1.5 秒时触发，提前松开会取消', () => {
  const source = parse(readFileSync('app/components/Admin/BroadcastPlayback.vue', 'utf8')).descriptor.scriptSetup!.content
  const threshold = source.match(/^const EMERGENCY_HOLD_MS = \d+$/m)
  assert.ok(threshold)
  const code = source.slice(source.indexOf('function cancelEmergencyHold'), source.indexOf('async function emergencyStop'))
  const createFixture = new Function(`
    const canEmergencyStop = { value: true }, emergencyPending = { value: false }, emergencyProgress = { value: 0 }
    ${threshold[0]}
    let emergencyFrame = 0, now = 0, sequence = 0, calls = 0
    const queue = new Map(), performance = { now: () => now }
    const requestAnimationFrame = callback => { queue.set(++sequence, callback); return sequence }
    const cancelAnimationFrame = id => queue.delete(id)
    const emergencyStop = () => { calls++ }
    ${code}
    return { startEmergencyHold, cancelEmergencyHold, calls: () => calls,
      tick: time => { now = time; const frames = [...queue.values()]; queue.clear(); frames.forEach(frame => frame()) } }
  `)
  const view = createFixture()
  view.startEmergencyHold({ type: 'pointerdown', isPrimary: true, button: 0 })
  view.tick(1499)
  assert.equal(view.calls(), 0)
  view.cancelEmergencyHold()
  view.tick(5000)
  assert.equal(view.calls(), 0)
  view.startEmergencyHold({ type: 'keydown' })
  view.tick(6499)
  assert.equal(view.calls(), 0)
  view.tick(6500)
  assert.equal(view.calls(), 1)
})

test('播放控制模板可编译且页面文案双语键同步', () => {
  const filename = 'app/components/Admin/BroadcastPlayback.vue'
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  assert.ok(compileScript(descriptor, { id: 'broadcast' }).content)
  assert.deepEqual(compileTemplate({ source: descriptor.template!.content, filename, id: 'broadcast' }).errors, [])
  assert.deepEqual(Object.keys(zhAdmin.broadcastPlayback), Object.keys(enAdmin.broadcastPlayback))
  assert.equal(zhAdmin.broadcastPlayback.emergencyHold, '长按 2 秒')
  assert.equal(enAdmin.broadcastPlayback.emergencyHold, 'Hold for 2 seconds')
  const auditActions = ['playback.unattended-enable', 'playback.unattended-disable', 'playback.auto-start', 'playback.auto-end', 'playback.remote-disarm', 'playback.emergency-stop']
  assert.deepEqual(Object.keys(zhAdmin.auditLog.actionLabels), auditActions)
  assert.deepEqual(Object.keys(enAdmin.auditLog.actionLabels), auditActions)
  for (const code of ['BROADCAST_ACCESS', 'BROADCAST_BUSY', 'BROADCAST_UNAVAILABLE'] as const) {
    assert.ok(zhErrors[code]); assert.ok(enErrors[code])
  }
})

test('连续坏源按排期逐首跳过，浏览器禁止自动播放回到人工继续', async () => {
  const source = parse(readFileSync('app/components/Admin/BroadcastPlayback.vue', 'utf8')).descriptor.scriptSetup!.content
  const code = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end))
  const simulate = new Function('entries', 'mediaResults', `
    const active = { value: { id: 'run', cursor: 0, entries } }
    const current = { get value() { return active.value?.entries[active.value.cursor] } }
    const closing = { value: false }, canControl = { value: true }, audio = { value: {} }
    const actions = [], notices = []
    const outcomes = { value: new Map() }
    const media = { reset() {}, async load(song) { return mediaResults[song.id - 1] } }
    const t = key => key
    const showToast = message => notices.push(message)
    const loadPage = () => {}
    const setBuffering = () => {}
    let ending = false
    async function command(request) {
      actions.push(request)
      active.value.cursor++
      if (active.value.cursor >= entries.length) active.value = null
      return { active: active.value, marked: false }
    }
    ${code('async function loadTrack', 'function applyControl')}
    ${code('async function advance', 'async function changeQuality')}
    return { active, actions, notices, outcomes, start: () => loadTrack(current.value) }
  `)
  const entries = [1, 2, 3].map(id => ({ id, song: { id, title: String(id) } }))
  const run = simulate(entries, ['failed', 'failed', 'blocked'])
  await run.start()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(run.actions.map(action => [action.entryId, action.result]), [[1, 'failed'], [2, 'failed']])
  assert.equal(run.active.value.cursor, 2)
  assert.deepEqual([...run.outcomes.value.values()], ['skipped', 'skipped'])
  assert.deepEqual(run.notices, ['sourceSkipped', 'sourceSkipped', 'autoplayBlocked'])

  const last = simulate(entries.slice(0, 1), ['failed'])
  await last.start()
  assert.equal(last.active.value, null)
  assert.deepEqual(last.notices, ['sourceEnded'])
})

test('手动开播不受已播记录限制，日期或结束时间不符时有明确原因', () => {
  const source = parse(readFileSync('app/components/Admin/BroadcastPlayback.vue', 'utf8')).descriptor.scriptSetup!.content
  const check = new Function('fixture', `
    const { active, busy, canControl, clock, closing, date, entries, loadError, mediaLoading, pending, selected, today } =
      Object.fromEntries(Object.entries(fixture).map(([key, value]) => [key, { value }]))
    const computed = read => read()
    const t = (key, ...args) => [key, ...args]
    ${source.slice(source.indexOf('const playBlockedReason'), source.indexOf('function explainPlayback'))}
    return playBlockedReason
  `)
  const fixture = {
    active: null, busy: false, canControl: true, clock: 1000, closing: false, date: '2026-11-22',
    entries: [{ song: { played: true } }], loadError: '', mediaLoading: false, pending: false,
    selected: { start: 2000, end: 4000 }, today: '2026-11-22'
  }
  assert.equal(check(fixture), '')
  assert.deepEqual(check({ ...fixture, date: '2026-11-23' }), ['playFutureDate'])
  assert.deepEqual(check({ ...fixture, date: '2026-11-21' }), ['playPastDate'])
  assert.deepEqual(check({ ...fixture, clock: 4000 }), ['playEnded'])
  assert.deepEqual(check({ ...fixture, entries: [] }), ['noTracks'])
  assert.deepEqual(check({ ...fixture, canControl: false }), ['playNeedsPermission'])
})

test('跨期望时段须先通过黄色站内确认，切换排期日期会使原确认失效', () => {
  const source = parse(readFileSync('app/components/Admin/ScheduleManager.vue', 'utf8')).descriptor.scriptSetup!.content
  const snippet = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end))
  const setup = new Function('locale', `
    const selectedDate = { value: '2026-11-23' }, selectedSemester = { value: 'current' }, selectedPlayTime = { value: '2' }
    const localScheduledSongs = { value: [] }, scheduledSongIds = { value: new Set() }, hasChanges = {}
    const showConfirmDialog = { value: false }, confirmAction = {}, confirmDialogTitle = {},
      confirmDialogMessage = {}, confirmDialogConfirmText = {}, confirmDialogType = {}
    const can = () => true, getPlayTimeName = id => id === 1 ? '午间公共广播' : '晚间公共广播'
    const setSongScheduledFlag = () => {}, vibrations = []
    const navigator = { vibrate: pattern => vibrations.push(pattern) }, touchDragData = { value: { item: null } }
    ${snippet('const getPlayTimeConflict', '// 从拖拽数据中查找歌曲')}
    ${snippet('const addSongToSchedule =', '// 从排期移除歌曲（点击方式）')}
    ${snippet('const handleTouchDropToSequence =', 'const handleTouchReorder =')}
    const confirm = () => { confirmAction.value(); showConfirmDialog.value = false }
    const cancel = () => { showConfirmDialog.value = false }
    return { placeSongInSchedule, handleTouchDropToSequence, touchDragData, vibrations, selectedDate, localScheduledSongs, showConfirmDialog, confirmDialogType, confirmDialogMessage, confirm, cancel }
  `)
  const view = setup({ value: zhAdmin.scheduleManager })
  const song = { id: 5, preferredPlayTimeId: 1 }
  view.placeSongInSchedule(song, song.id)
  assert.equal(view.showConfirmDialog.value, true)
  assert.equal(view.confirmDialogType.value, 'warning')
  assert.match(view.confirmDialogMessage.value, /午间公共广播.*晚间公共广播/)
  assert.deepEqual(view.localScheduledSongs.value, [])
  view.cancel()
  assert.deepEqual(view.localScheduledSongs.value, [])

  view.placeSongInSchedule(song, song.id)
  view.selectedDate.value = '2026-11-24'
  view.confirm()
  assert.deepEqual(view.localScheduledSongs.value, [])

  const matching = { id: 6, preferredPlayTimeId: 2 }
  view.placeSongInSchedule(matching, matching.id)
  assert.equal(view.showConfirmDialog.value, false)
  view.placeSongInSchedule(song, song.id, { dropIndex: 0 })
  view.confirm()
  assert.deepEqual(view.localScheduledSongs.value.map(row => [row.song.id, row.sequence]), [[5, 1], [6, 2]])

  view.touchDragData.value.item = { id: 7, preferredPlayTimeId: 1 }
  view.handleTouchDropToSequence(null)
  assert.equal(view.showConfirmDialog.value, true)
  assert.deepEqual(view.vibrations, [])
  assert.equal(view.localScheduledSongs.value.length, 2)
  view.confirm()
  assert.equal(view.localScheduledSongs.value.at(-1).isLocalOnly, true)
  assert.equal(view.localScheduledSongs.value.at(-1).song.id, 7)
  assert.deepEqual(view.vibrations, [[30, 50, 30]])
})
