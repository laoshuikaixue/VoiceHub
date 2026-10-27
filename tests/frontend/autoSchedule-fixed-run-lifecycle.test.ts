import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { computed, ref } from 'vue'
import {
  autoSchedule,
  autoScheduleExhaustive,
  fixedCandidatesFromScheduled
} from '../../app/utils/autoSchedule.ts'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')

// 组件内需要真实执行的声明，其余依赖用桩注入
const componentDeclarations = [
  'autoScheduleFixedSongs',
  'autoScheduleScheduledSeconds',
  'autoScheduleFixedMissingDuration',
  'autoScheduleFixedNeedsDuration',
  'buildPreSelected',
  'autoScheduleResolvingFixed',
  'AUTO_SCHEDULE_FIXED_DURATION_TIMEOUT',
  'autoScheduleRunId',
  'autoScheduleResolveController',
  'autoScheduleRunning',
  'applyFixedDuration',
  'runConcurrent',
  'resolveFixedSongDurations',
  'cancelAutoScheduleRun',
  'autoScheduleRunningText',
  'runAutoSchedule',
  'openAutoScheduleDialog',
  'closeAutoScheduleDialog'
]

const makeSong = (id, title, durationSeconds, extra = {}) => ({
  id,
  title,
  artist: '测试',
  durationSeconds,
  musicPlatform: 'netease',
  musicId: `m${id}`,
  requester: `同学${(id % 5) + 1}`,
  ...extra
})

// 3 首有时长 + 1 首可补齐 + 1 首缺音源信息，其中可补齐的歌同时存在于已发布和草稿
const scheduledFixture = () => [
  { song: makeSong(1, '晴天', 269) },
  { song: makeSong(2, '稻香', 223) },
  { song: makeSong(3, '七里香', null) },
  { song: makeSong(4, '起风了', null, { musicPlatform: null, musicId: null }) },
  { song: makeSong(3, '七里香', null) }
]

const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((resolve) => setImmediate(resolve))
}

function createScheduleRun(requestSongDuration) {
  const source = readFileSync(
    new URL('../../app/components/Admin/ScheduleManager.vue', import.meta.url),
    'utf8'
  )
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'auto-schedule-run' })
  const inits = new Map()
  for (const node of script.scriptSetupAst || []) {
    for (const item of node.declarations || []) inits.set(item.id.name, item.init)
  }

  const timers = new Map()
  let timerId = 0
  let clock = 0
  const setTimeoutStub = (fn, ms) => {
    timers.set(++timerId, { at: clock + (ms || 0), fn })
    return timerId
  }
  const clearTimeoutStub = (id) => {
    timers.delete(id)
  }

  const context = vm.createContext({
    computed,
    ref,
    AbortController,
    autoSchedule,
    autoScheduleExhaustive,
    fixedCandidatesFromScheduled,
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    requestSongDuration,
    heatWeightRatio: () => 0.8,
    callLocale: (_key, fallback) => fallback,
    locale: {
      value: {
        fixExistingResolvingDuration: (progress) => `补齐时长 ${progress}`,
        autoScheduleRunning: '计算中'
      }
    },
    window: { $showNotification: () => {} },
    localScheduledSongs: ref(scheduledFixture()),
    songs: ref([]),
    songPool: ref([]),
    autoScheduleFixExisting: ref(true),
    autoScheduleCandidates: ref([
      makeSong(6, '光年之外', 235),
      makeSong(7, '孤勇者', 257),
      makeSong(8, '平凡之路', 302)
    ]),
    autoScheduleAlgorithm: ref('greedy'),
    autoScheduleDirection: ref('under'),
    autoScheduleTargetMinutes: ref(30),
    autoScheduleTargetSongCount: ref(null),
    autoScheduleTargetRequesterCount: ref(null),
    autoScheduleOptions: ref({}),
    autoSchedulePlans: ref([]),
    currentPlanIndex: ref(0),
    autoScheduleResult: ref({ songs: [], totalDuration: 0, diff: 0, absDiff: 0 }),
    showAutoScheduleDialog: ref(true)
  })

  for (const name of componentDeclarations) {
    const init = inits.get(name)
    assert.ok(init, `ScheduleManager.vue 缺少声明 ${name}`)
    const code = descriptor.scriptSetup.content.slice(init.start, init.end)
    new vm.Script(`var ${name} = (${code})`).runInContext(context)
  }

  const read = (expression) => vm.runInContext(expression, context)
  const advance = async (ms) => {
    clock += ms
    const due = [...timers.entries()]
      .filter(([, timer]) => timer.at <= clock)
      .sort((a, b) => a[1].at - b[1].at)
    for (const [id, timer] of due) {
      timers.delete(id)
      timer.fn()
      await settle()
    }
    await settle()
  }

  return { context, read, advance, timers }
}

test('固定数量、剩余时长与待补时长共用去重后的固定列表', () => {
  const { read } = createScheduleRun(async () => ({ success: true, durationSeconds: 299 }))

  assert.equal(read('localScheduledSongs.value.length'), 5, '排期条目含同一首歌的重复行')
  assert.equal(read('autoScheduleFixedSongs.value.length'), 4, '同一首歌只固定一次')
  assert.equal(read('buildPreSelected().length'), 4)
  assert.equal(read('autoScheduleScheduledSeconds.value'), 492, '未知时长按 0 计入')
  assert.equal(read('autoScheduleFixedMissingDuration.value'), 2)
  assert.equal(read('autoScheduleFixedNeedsDuration.value.length'), 1, '缺音源信息的歌曲不尝试补齐')
  assert.equal(read('autoScheduleFixedNeedsDuration.value[0].musicId'), 'm3', '补齐用原始歌曲对象')
})

test('补时长预算到期即结束等待，悬挂请求不再阻塞排期', async () => {
  let releaseLate
  const signals = []
  const { read, advance, timers } = createScheduleRun((song, signal) => {
    signals.push(signal)
    return new Promise((resolve) => {
      releaseLate = () => resolve({ success: true, durationSeconds: 299 })
    })
  })

  const running = read('runAutoSchedule()')
  await settle()
  assert.equal(read('autoScheduleRunning.value'), true, '补齐阶段仍在运行')
  assert.equal(signals.length, 1, '只请求缺失时长的固定歌曲')
  assert.equal(read('autoScheduleResult.value.songs.length'), 0)

  await advance(20000)
  await running

  assert.equal(read('autoScheduleResult.value.songs.filter(s => s.isFixed).length'), 4, '预算到期后仍给出含全部固定歌曲的方案')
  assert.equal(read('autoScheduleRunning.value'), false)
  assert.equal(timers.size, 0, '预算定时器已清理')
  assert.equal(read('autoScheduleResolveController'), null)

  releaseLate()
  await settle()
  assert.equal(read('localScheduledSongs.value[2].song.durationSeconds'), null, '迟到的时长不回写')
})

test('关闭弹窗作废旧任务，重开弹窗不会回填旧方案', async () => {
  let releaseLate
  const signals = []
  const { read, context } = createScheduleRun((song, signal) => {
    signals.push(signal)
    return new Promise((resolve) => {
      releaseLate = () => resolve({ success: true, durationSeconds: 299 })
    })
  })

  const running = read('runAutoSchedule()')
  await settle()
  read('closeAutoScheduleDialog()')
  assert.equal(read('autoScheduleRunning.value'), false, '关闭后按钮恢复可用')
  assert.equal(context.autoScheduleResolvingFixed.value.running, false)

  releaseLate()
  await running
  await settle()

  assert.equal(signals[0].aborted, true, '关闭时中止在途请求')
  assert.equal(read('autoScheduleResult.value.songs.length'), 0, '旧任务不回填方案')
  assert.equal(read('localScheduledSongs.value[2].song.durationSeconds'), null, '旧任务不回写时长')

  read('openAutoScheduleDialog()')
  assert.equal(read('autoScheduleResult.value.songs.length'), 0, '重开弹窗需重新运行排期')
})

test('运行中的重复点击不会叠加补齐请求', async () => {
  let requestCount = 0
  const { read, advance } = createScheduleRun(() => {
    requestCount++
    return new Promise(() => {})
  })

  const first = read('runAutoSchedule()')
  await settle()
  read('runAutoSchedule()')
  await settle()
  assert.equal(requestCount, 1)

  await advance(20000)
  await first
  assert.equal(read('autoScheduleRunning.value'), false)
})
