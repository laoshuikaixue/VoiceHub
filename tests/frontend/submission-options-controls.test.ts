import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { computed, ref } from 'vue'
import { formatDateTime, getBeijingDateString, getBeijingWeekday, parseUtcTimestamp } from '../../app/utils/timeUtils.ts'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const root = new URL('../../', import.meta.url)
const clock = () => new Date('2026-10-26T16:45:12.000Z')

function setup(file: string, names: string[], globals: Record<string, unknown>) {
  const source = readFileSync(new URL(file, root), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'submission-controls' })
  const declarations = script.scriptSetupAst.flatMap((node: any) => node.declarations || [])
  const context = vm.createContext({ computed, ref, formatDateTime, getBeijingDateString, getSyncedDate: clock, ...globals })
  for (const name of names) {
    const declaration = declarations.find((item: any) => item.id.name === name)
    assert.ok(declaration, `${file}: ${name}`)
    const code = descriptor.scriptSetup.content.slice(declaration.init.start, declaration.init.end)
    new vm.Script(`var ${name} = (${code})`).runInContext(context)
  }
  return { context, source, script, descriptor }
}

const pickerPath = (name: string) => `app/components/UI/Common/${name}.vue`
const combinedNames = [
  'pad2', 'toISODate', 'parseCombined', 'parseISODate', 'currentDate', 'todayDate', 'todayISO',
  'selected', 'selectedDate', 'selectedTime', 'hour', 'minute', 'buildTimeString',
  'currentDateISO', 'emitValue', 'selectHour', 'selectMinute', 'selectDay', 'goToday'
]

function combined(value: string) {
  const emitted: string[] = []
  const props = { modelValue: value, today: '', minuteStep: 1 }
  const { context } = setup(pickerPath('AppDateTimePicker'), combinedNames, {
    props, emit: (event: string, value: string) => { if (event === 'update:modelValue') emitted.push(value) },
    scrollColumnToValue: () => {}, hourColRef: {}, minuteColRef: {}, hours: ref([]), minutes: ref([]),
    isOpen: ref(true), todayDisabled: ref(false), viewYear: ref(2026), viewMonth: ref(0)
  })
  return { context, emitted, props }
}

test('日期时间选择器回显数据库时间，编辑时保留原日期与秒精度', () => {
  for (const value of ['2027-01-08 14:30:25', '2027-01-08T14:30:25.123456']) {
    const { context, emitted } = combined(value)
    assert.equal(vm.runInContext('currentDateISO()', context), '2027-01-08')
    vm.runInContext('selectHour(16)', context)
    assert.equal(emitted.pop(), value.replace(' ', 'T').replace('14:30', '16:30'))
    vm.runInContext('selectMinute(40)', context)
    assert.equal(emitted.pop(), value.replace(' ', 'T').replace('14:30', '14:40'))
    vm.runInContext("selectDay({ iso: '2027-01-09', disabled: false })", context)
    assert.equal(emitted.pop(), value.replace(' ', 'T').replace('2027-01-08', '2027-01-09'))
  }
  const { context } = combined('2027-01-08T14:30')
  assert.equal(vm.runInContext('buildTimeString(16, 40)', context), '16:40')
})

test('日期和时间默认值使用同步后的北京时间', () => {
  const { context, emitted } = combined('')
  assert.equal(vm.runInContext('todayISO.value', context), '2026-10-27')
  vm.runInContext("selectDay({ iso: '2027-01-09', disabled: false })", context)
  assert.equal(emitted.pop(), '2027-01-09T00:45')
  vm.runInContext('goToday()', context)
  assert.equal(emitted.pop(), '2026-10-27T00:45')

  const time = setup(pickerPath('AppTimePicker'), ['pad2', 'buildTimeString', 'emitValue', 'goNow'], {
    props: { minuteStep: 15 }, emit: (event: string, value: string) => { if (event === 'update:modelValue') emitted.push(value) },
    syncViewToValue: () => {}
  })
  vm.runInContext('goNow()', time.context)
  assert.equal(emitted.pop(), '00:45')

  const date = setup(pickerPath('AppDatePicker'), ['parseISODate', 'currentDate', 'todayDate'], { props: { today: '' } })
  assert.equal(vm.runInContext('todayDate.value.day', date.context), 27)
})

test('三个选择器打开时聚焦浮层，关闭后恢复触发器焦点', async () => {
  for (const name of ['AppDatePicker', 'AppTimePicker', 'AppDateTimePicker']) {
    let popupFocused = false
    let triggerFocused = false
    const activeElement = {}
    const { context, source, script, descriptor } = setup(pickerPath(name), ['toggle'], {
      props: { disabled: false }, isOpen: ref(false), currentDate: ref(''), syncViewToValue: () => {},
      nextTick: async () => {}, updatePosition: () => {}, requestAnimationFrame: () => {},
      popupRef: ref({ focus: () => { popupFocused = true }, contains: (element: unknown) => element === activeElement }),
      triggerRef: ref({ focus: () => { triggerFocused = true } }), document: { activeElement },
      window: { removeEventListener: () => {} }, onOpenChange: () => {}, handleViewportChange: () => {}
    })
    await vm.runInContext('toggle()', context)
    assert.equal(popupFocused, true, name)
    const watcher = script.scriptSetupAst.find((node: any) => node.type === 'ExpressionStatement' && node.expression.callee?.name === 'watch')
    const callback = watcher.expression.arguments[1]
    new vm.Script(`(${descriptor.scriptSetup.content.slice(callback.start, callback.end)})(false)`).runInContext(context)
    assert.equal(triggerFocused, true, name)
    assert.equal((source.match(/@keydown\.esc\.stop="close"/g) || []).length, 2, name)
  }
})

test('手动点击事件不能被当作时段弹窗续跑标志', async () => {
  const pending: unknown[] = []
  const { context } = setup('app/components/Songs/RequestForm.vue', ['handleManualSubmit'], {
    title: ref('歌曲'), manualArtist: ref('歌手'), manualCover: ref(''), manualPlayUrl: ref(''),
    requiresSlotSelection: ref(true), openRequiredSlotOptions: (value: unknown) => pending.push(value),
    validatePlaySlotSelection: () => { throw new Error('不应跳过收集弹窗') }
  })
  await vm.runInContext("handleManualSubmit({ type: 'click' })", context)
  assert.equal((pending[0] as any).manualForm, true)
})

test('重播可免选时段，普通投稿仍要求选择', () => {
  const { context, source } = setup('app/components/Songs/RequestForm.vue', ['validatePlaySlotSelection'], {
    playTimeSelectionEnabled: ref(true), playSlotRequired: ref(true), preferredPlayTimeId: ref(''),
    playSlotError: ref(''), error: ref(''), locale: ref({ playSlotTimeRequiredError: '必选' }), window: {}
  })
  assert.equal(vm.runInContext('validatePlaySlotSelection(false)', context), true)
  assert.equal(vm.runInContext('validatePlaySlotSelection()', context), false)
  assert.match(source, /validatePlaySlotSelection\(options\.replayRequest !== true\)/)
})

test('星期配置丢弃 null、布尔值和字符串，仅保留有效整数', () => {
  const source = readFileSync(new URL('server/utils/play-slot.ts', root), 'utf8')
  const executable = stripTypeScriptTypes(source.replace(/^import .*$/gm, '').replace(/^export /gm, ''))
  const context = vm.createContext({})
  new vm.Script(executable).runInContext(context)
  assert.equal(vm.runInContext("normalizeWeekdays([null, '', false, true, '1', 7, -1, 1.5])", context), null)
  assert.equal(vm.runInContext('JSON.stringify(normalizeWeekdays([6, 0, 6, 2]))', context), '[0,2,6]')
})

test('点歌券 UTC 时间按北京时间展示，失败明细不采用服务端原文', () => {
  const { context } = setup('app/components/Admin/CardCodesManager.vue', ['formatDate', 'localizeAssignmentFailure'], {
    parseUtcTimestamp, locale: ref({ assignFailed: 'Assignment failed' }),
    localizeServerError: (error: any, fallback: string) => error?.data?.code === 'CARD_CODE_ASSIGN_FAILED' ? 'Localized failure' : fallback
  })
  assert.equal(vm.runInContext("formatDate('2026-10-26 16:45:12')", context), '2026/10/27 00:45')
  assert.equal(vm.runInContext("formatDate('invalid')", context), '—')
  assert.equal(vm.runInContext("localizeAssignmentFailure({ failureReason: '内部异常' })", context), 'Assignment failed')

  const dispatch = setup('app/components/Admin/CardCodeDispatchModal.vue', ['localizeFailure'], {
    locale: ref({ assignFailed: 'Assignment failed' }),
    localizeServerError: (error: any, fallback: string) => error?.data?.code === 'CARD_CODE_ASSIGN_FAILED' ? 'Localized failure' : fallback
  })
  assert.equal(vm.runInContext("localizeFailure({ code: 'VH-ABC', reason: '内部异常' })", dispatch.context), 'Assignment failed')
  assert.equal(vm.runInContext("localizeFailure({ code: 'VH-ABC', error: { code: 'CARD_CODE_ASSIGN_FAILED' } })", dispatch.context), 'Localized failure')
})

test('播出日期星期使用当前语言词典', () => {
  const songsLocale = ref({ requestForm: { weekdaysFull: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] } })
  const { context } = setup('app/components/Admin/SongManagement.vue', ['formatPlaySlotDisplay'], {
    getBeijingWeekday, songsLocale, getPlayTimeName: () => 'Lunch'
  })
  assert.equal(vm.runInContext("formatPlaySlotDisplay({ preferredPlayDate: '2026-10-26', preferredPlayTimeId: 1 })", context), '2026-10-26 Mon · Lunch')
  songsLocale.value.requestForm.weekdaysFull[1] = '周一'
  assert.equal(vm.runInContext("formatPlaySlotDisplay({ preferredPlayDate: '2026-10-26' })", context), '2026-10-26 周一')
})

test('播放状态操作先打开二次确认，确认执行期间不会重复提交', async () => {
  for (const handler of ['batchMarkPlayed', 'batchMarkUnplayed']) {
    const shared = {
      loading: ref(false),
      batchMarking: ref(false),
      selectedSongs: ref([1, 2]),
      playbackConfirmSongIds: ref([] as number[]),
      playbackConfirmMode: ref(''),
      showPlaybackConfirm: ref(false)
    }
    const state = setup('app/components/Admin/SongManagement.vue', [handler, 'openPlaybackConfirm'], shared)
    vm.runInContext(`${handler}()`, state.context)
    assert.equal(vm.runInContext('showPlaybackConfirm.value', state.context), true)
    assert.equal(vm.runInContext('playbackConfirmMode.value', state.context), handler === 'batchMarkPlayed' ? 'played' : 'unplayed')
    assert.equal(vm.runInContext('JSON.stringify(playbackConfirmSongIds.value)', state.context), '[1,2]')

    let release: () => void = () => {}
    let calls = 0
    const confirmation = setup('app/components/Admin/SongManagement.vue', ['confirmPlaybackChange'], {
      batchMarking: shared.batchMarking,
      loading: shared.loading,
      playbackConfirmSongIds: ref([1]),
      playbackConfirmMode: ref('played'),
      showPlaybackConfirm: shared.showPlaybackConfirm,
      executePlaybackChange: async () => {
        calls += 1
        await new Promise<void>((resolve) => { release = resolve })
        return 1
      },
      getNestedMessage: () => 'ok',
      showNotification: () => {}
    })
    shared.batchMarking.value = false
    const pending = vm.runInContext('confirmPlaybackChange()', confirmation.context)
    vm.runInContext('confirmPlaybackChange()', confirmation.context)
    assert.equal(calls, 1)
    release()
    await pending
    assert.equal(shared.batchMarking.value, false)
  }
})
