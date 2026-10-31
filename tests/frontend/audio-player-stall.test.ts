import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { nextTick, ref, shallowRef, watch } from 'vue'
import { isPreviewClipDuration } from '../../app/utils/preview-duration.ts'

const require = createRequire(import.meta.url)
const { parse, compileScript } = require('vue/compiler-sfc')
const source = readFileSync(new URL('../../app/components/UI/AudioPlayer.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'playback-stall' })
const declarations = script.scriptSetupAst.flatMap((node) => node.declarations || [])
function load(names: string[], globals: Record<string, unknown>) {
  const context = vm.createContext(globals)
  for (const name of names) {
    const declaration = declarations.find((item) => item.id.name === name)
    assert.ok(declaration, name)
    const code = descriptor.scriptSetup.content.slice(declaration.init.start, declaration.init.end)
    new vm.Script(`var ${name} = (${code})`).runInContext(context)
  }
  return context
}

function fixture(overrides = {}) {
  const timers = new Map<number, () => Promise<void>>()
  let nextTimer = 0
  const errors = []
  const notices = []
  const state = { switches: 0 }
  const song = ref({ id: 1, musicPlatform: 'netease' })
  const context = load([
    'isSourceRecoveryCurrent', 'PLAYBACK_STALL_TIMEOUT_MS', 'stallTimer', 'clearStallWatch', 'armStallWatch', 'checkPlaybackStall',
    'handleNetworkStall', 'handleCanPlay', 'handleLoadStart'
  ], {
    setTimeout: (callback, ms) => { assert.equal(ms, 8000); timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: (id) => timers.delete(id),
    audioPlayer: ref({ readyState: 1, paused: false }),
    activeSong: song, getPreviewSongKey: (value) => value?.id, sourceRecoveryEpoch: 0,
    isFallbackHandling: ref(false), isClosing: ref(false), isClosed: ref(false),
    control: { isPlaying: ref(true), isLoadingTrack: ref(true), onCanPlay() {}, onLoadStart() {} },
    navigator: { onLine: true },
    audioPlayerLocale: ref({ slowNetworkRetry: '换源成功', slowNetworkFailed: '换源失败' }),
    window: { $showNotification: (...args) => notices.push(args) },
    handleError: async (...args) => { errors.push(args) },
    trySwitchPlaybackSource: async () => { state.switches++; return false },
    ...overrides
  })
  const fire = async () => {
    const [id, callback] = timers.entries().next().value!
    timers.delete(id)
    await callback()
  }
  return { context, timers, errors, notices, state, song, fire }
}

test('重复缓冲事件不延后首次超时，恢复播放后清除监视器', () => {
  const { context, timers } = fixture()
  vm.runInContext('handleLoadStart(); handleNetworkStall(); handleNetworkStall()', context)
  assert.deepEqual([...timers.keys()], [1])
  vm.runInContext('handleCanPlay()', context)
  assert.equal(timers.size, 0)
  vm.runInContext('handleNetworkStall(); handleLoadStart()', context)
  assert.deepEqual([...timers.keys()], [3])
})

test('超时换源失败后进入统一错误恢复，不重复执行同一轮换源', async () => {
  const { context, state, errors, fire } = fixture()
  vm.runInContext('handleNetworkStall()', context)
  await fire()
  assert.equal(state.switches, 1)
  assert.equal(errors.length, 1)
  assert.equal(errors[0][1].skipSourceSwitch, true)
})

test('等待换源时切歌，不把旧歌曲的失败应用到新歌', async () => {
  let release
  const { context, errors, notices, song, fire } = fixture({
    trySwitchPlaybackSource: () => new Promise((resolve) => { release = resolve })
  })
  vm.runInContext('handleNetworkStall()', context)
  const pending = fire()
  song.value = { id: 2, musicPlatform: 'netease' }
  release(false)
  await pending
  assert.equal(errors.length, 0)
  assert.equal(notices.length, 0)
})

test('离线、暂停和缓冲已恢复时不换源', async () => {
  for (const overrides of [
    { navigator: { onLine: false } },
    { audioPlayer: ref({ readyState: 3, paused: false }) },
    { audioPlayer: ref({ readyState: 1, paused: true }), control: { isPlaying: ref(false), isLoadingTrack: ref(false) } }
  ]) {
    const { context, state, errors, fire } = fixture(overrides)
    vm.runInContext('handleNetworkStall()', context)
    await fire()
    assert.equal(state.switches, 0)
    assert.equal(errors.length, 0)
  }
})

test('超时进入错误恢复后仍计入连续失败保护', async () => {
  let switches = 0
  let stops = 0
  const failures = ref(2)
  const context = load(['handleError'], {
    clearStallWatch() {},
    audioPlayer: ref({ src: 'https://music.163.com/audio.mp3' }),
    window: { location: { href: 'https://voicehub.example/', origin: 'https://voicehub.example' }, $showNotification() {} },
    isFallbackHandling: ref(false), navigator: { onLine: true }, MediaError: { MEDIA_ERR_DECODE: 3, MEDIA_ERR_SRC_NOT_SUPPORTED: 4 },
    trySwitchPlaybackSource: async () => { switches++; return false },
    props: { isPlaylistMode: true }, control: { playMode: ref('order') },
    consecutiveSkipCount: failures, MAX_CONSECUTIVE_SKIP: 3,
    audioPlayerLocale: ref({ consecutiveFailures: '连续失败' }),
    stopPlaying: () => { stops++ }, console: { log() {} }
  })
  await vm.runInContext("handleError(new Error('加载超时'), { skipSourceSwitch: true })", context)
  assert.equal(switches, 0)
  assert.equal(failures.value, 3)
  assert.equal(stops, 1)
})

function previewFixture(t) {
  const timers = new Map()
  let timerId = 0
  const requests = []
  const notices = []
  const emitted = []
  const loaded = []
  const activeSong = ref({ id: 1, title: '歌曲一', musicPlatform: 'tencent', musicId: 'a',
    durationSeconds: 240, schedulePlaybackKey: 1, sourceInfo: { playSource: 'preview-source' } })
  class AudioFixture extends EventTarget {
    duration = 60
    currentTime = 0
    currentSrc = 'https://audio.example/preview.mp3'
    src = this.currentSrc
  }
  const element = new AudioFixture()
  const audioPlayer = shallowRef(element)
  const control = { isLoadingTrack: ref(false), isPlaying: ref(true), hasError: ref(false),
    play: async () => true, onLoaded: (duration) => loaded.push(duration) }
  const context = load([
    'getPreviewSongKey', 'sourceRecoveryEpoch', 'badDurationFixTask', 'previewWarnedSongKey',
    'invalidateSourceRecovery', 'isSourceRecoveryCurrent', 'getCurrentFailedSource', 'buildFallbackResolveOptions',
    'trySwitchPlaybackSource', 'normalizeSongDurationSeconds', 'isPreviewAudio', 'notifyPreviewOnly',
    'PREVIEW_RECHECK_TIMEOUT_MS', 'notifyIfStillPreview', 'BAD_DURATION_FIX_TIMEOUT_MS',
    'maybeSwitchForBadDuration', 'handleLoaded'
  ], {
    activeSong, audioPlayer, control, watch, nextTick,
    isFallbackHandling: ref(false), isClosing: ref(false), isClosed: ref(false),
    failedPlaybackSources: ref([]), lastOpenedFallbackSongId: ref(null),
    enhanced: { resetRetryState() {} }, resetNeteaseScrobbleState() {},
    isBilibiliSong: () => false, getQuality: () => 8, getCachedMusicUrlSource: () => 'preview-source',
    isInvalidTencentAudio: () => false, isPreviewClipDuration,
    PLATFORM_AUTHORIZED_PLATFORMS: ['tencent', 'netease', 'netease-podcast', 'migu'],
    audioPlayerLocale: ref({ previewOnly: '仅试听' }),
    window: { $showNotification: (...args) => notices.push(args) },
    setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId },
    clearTimeout: (id) => timers.delete(id), console: { warn() {} },
    getMusicUrlResult: (_platform, musicId, _url, options) => new Promise((resolve, reject) => {
      requests.push({ musicId, options, resolve, reject })
    }),
    sync: { globalAudioPlayer: { updateCurrentSong: (song) => { activeSong.value = song } } },
    emit: (_event, song) => {
      emitted.push(song)
      element.currentSrc = element.src = song.musicUrl
    }
  })
  const identityWatch = script.scriptSetupAst.find((node) => node.expression?.callee?.name === 'watch' &&
    descriptor.scriptSetup.content.slice(node.expression.arguments[0].start, node.expression.arguments[0].end).includes('getPreviewSongKey'))
  assert.ok(identityWatch)
  const stopWatch = new vm.Script(descriptor.scriptSetup.content.slice(identityWatch.start, identityWatch.end)).runInContext(context)
  t.after(() => {
    vm.runInContext('invalidateSourceRecovery()', context)
    stopWatch()
  })
  const changeSong = (id, schedulePlaybackKey = id) => {
    activeSong.value = { ...activeSong.value, id, musicId: String.fromCharCode(96 + id), schedulePlaybackKey }
  }
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
  const run = (code = 'maybeSwitchForBadDuration(audioPlayer.value.duration)') => vm.runInContext(code, context)
  return { context, activeSong, element, audioPlayer, control, requests, notices, emitted, loaded, timers, changeSong, flush, run }
}

test('旧歌曲换源失败后不提示正在完整播放的新歌曲', async (t) => {
  const f = previewFixture(t)
  const pending = f.run()
  f.changeSong(2)
  f.element.duration = 240
  assert.equal(await pending, false)
  f.requests[0].resolve({ url: null })
  await f.flush()
  assert.deepEqual(f.notices, [])
  assert.deepEqual(f.emitted, [])
})

test('上一首换源超时后，下一首可独立换源且旧任务不清除新锁', async (t) => {
  const f = previewFixture(t)
  const first = f.run()
  for (const timer of f.timers.values()) if (timer.ms === 15000) timer.callback()
  assert.equal(await first, false)
  f.changeSong(2)
  const second = f.run()
  assert.equal(f.requests.length, 2)
  const newTask = f.context.badDurationFixTask
  f.requests[0].resolve({ url: 'https://audio.example/full-a.mp3', source: 'old-full' })
  await f.flush()
  assert.equal(f.context.badDurationFixTask, newTask)
  assert.equal(f.context.isFallbackHandling.value, true)
  assert.equal(f.control.isLoadingTrack.value, true)
  assert.deepEqual(f.emitted, [])
  f.element.duration = 240
  f.requests[1].resolve({ url: 'https://audio.example/full-b.mp3', source: 'new-full' })
  assert.equal(await second, true)
  assert.equal(f.activeSong.value.id, 2)
  assert.equal(f.activeSong.value.musicUrl, 'https://audio.example/full-b.mp3')
  assert.equal(f.context.badDurationFixTask, null)
  assert.equal(f.timers.size, 0)
})

test('同歌重新排期和切歌后返回原歌都丢弃旧结果', async (t) => {
  for (const returnThroughAnotherSong of [false, true]) {
    const f = previewFixture(t)
    const first = f.run()
    if (returnThroughAnotherSong) f.changeSong(2)
    const playbackKey = returnThroughAnotherSong ? 1 : 2
    f.changeSong(1, playbackKey)
    assert.equal(await first, false)
    const second = f.run()
    f.requests[0].resolve({ url: 'https://audio.example/stale.mp3', source: 'stale' })
    await f.flush()
    assert.deepEqual(f.emitted, [])
    assert.equal(f.context.isFallbackHandling.value, true)
    f.element.duration = 240
    f.requests[1].resolve({ url: 'https://audio.example/current.mp3', source: 'current' })
    assert.equal(await second, true)
    assert.equal(f.activeSong.value.schedulePlaybackKey, playbackKey)
  }
})

test('同首歌曲并发时长事件只换源一次，结束后清除超时计时器', async (t) => {
  const f = previewFixture(t)
  const pending = f.run()
  assert.equal(await f.run(), false)
  assert.equal(f.requests.length, 1)
  f.requests[0].resolve({ url: null })
  assert.equal(await pending, false)
  assert.equal(f.notices.length, 1)
  assert.equal(f.timers.size, 0)
})

test('取消旧加载回调后不把新歌曲元数据传给旧处理流程', async (t) => {
  const f = previewFixture(t)
  const pending = f.run('handleLoaded()')
  f.changeSong(2)
  f.element.duration = 240
  await pending
  assert.deepEqual(f.loaded, [])
  assert.equal(f.timers.size, 0)
  f.requests[0].resolve({ url: null })
  await f.flush()
  assert.deepEqual(f.notices, [])
})

test('关闭播放器取消换源等待，迟到结果不重新起播', async (t) => {
  const f = previewFixture(t)
  const pending = f.run()
  f.run('invalidateSourceRecovery(); isClosing.value = true')
  assert.equal(await pending, false)
  assert.equal(f.timers.size, 0)
  f.requests[0].resolve({ url: 'https://audio.example/late.mp3', source: 'late' })
  await f.flush()
  assert.deepEqual(f.emitted, [])
  assert.deepEqual(f.notices, [])
})

test('换源后的元数据复查会清除监听器，并忽略已经切走的歌曲', async (t) => {
  const f = previewFixture(t)
  let listeners = 0
  const add = f.element.addEventListener.bind(f.element)
  const remove = f.element.removeEventListener.bind(f.element)
  f.element.addEventListener = (...args) => { listeners++; add(...args) }
  f.element.removeEventListener = (...args) => { listeners--; remove(...args) }
  f.element.duration = NaN
  const pending = f.run('notifyIfStillPreview(audioPlayer.value, getPreviewSongKey(activeSong.value), sourceRecoveryEpoch)')
  assert.equal(listeners, 1)
  f.changeSong(2)
  f.element.duration = 60
  f.element.dispatchEvent(new Event('loadedmetadata'))
  await pending
  assert.equal(listeners, 0)
  assert.equal(f.timers.size, 0)
  assert.deepEqual(f.notices, [])
})
