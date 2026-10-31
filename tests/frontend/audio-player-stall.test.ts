import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { ref } from 'vue'

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
    'PLAYBACK_STALL_TIMEOUT_MS', 'stallTimer', 'clearStallWatch', 'armStallWatch', 'checkPlaybackStall',
    'handleNetworkStall', 'handleCanPlay', 'handleLoadStart'
  ], {
    setTimeout: (callback, ms) => { assert.equal(ms, 8000); timers.set(++nextTimer, callback); return nextTimer },
    clearTimeout: (id) => timers.delete(id),
    audioPlayer: ref({ readyState: 1, paused: false }),
    activeSong: song, getScrobblePlaybackIdentity: (value) => value?.id,
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
