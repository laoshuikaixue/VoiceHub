import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createRenderer, ref } from 'vue'
import type { useAudioPlayer } from '../../app/composables/useAudioPlayer'
import type { useAudioPlayerControl } from '../../app/composables/useAudioPlayerControl'
import type { useAudioPlayerSync } from '../../app/composables/useAudioPlayerSync'
import type { useSchedulePlaylistSync, notifySchedulePlaylistChanged } from '../../app/composables/useSchedulePlaylistSync'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const dependencies: Record<string, string> = {
  '~/utils/locale': "export const useLocale = () => ({ audioPlayer: { value: { consecutiveFailures: '连续失败', networkOffline: '断网', nextFailed: '下一首失败', previousFailed: '上一首失败', scheduleSyncFailed: '队列更新失败', scheduleSyncAuthChanged: '身份变化' } } })",
  '~/composables/useMusicSources': 'export const useMusicSources = () => ({ getLyrics: async () => null })',
  '~/composables/useLyricSettings': "export const useLyricSettings = () => ({ lyricPriority: { value: 'auto' } })",
  '~/utils/bilibiliSource': "export const isBilibiliSong = song => song.musicPlatform === 'bilibili'",
  '~/utils/musicUrl': 'export const getMusicUrl = (...args) => globalThis.__resolveScheduleTestMusic(...args)',
  '~/composables/useAudioQuality': 'export const useAudioQuality = () => ({})',
  '~/composables/useLyrics': 'export const useLyrics = () => ({ clearLyrics() {}, fetchLyrics: async () => null })',
  '~/composables/useMusicWebSocket': 'export const useMusicWebSocket = () => ({})',
  '~/composables/useAuth': 'export const useAuth = () => globalThis.__scheduleSyncTestAuth',
  '~/composables/useLocaleText': "export const useServerErrors = () => ({ localize: (_error, fallback) => fallback || '服务端错误' })"
}
const result = await build({
  stdin: { contents: "export { useAudioPlayer } from './app/composables/useAudioPlayer'; export { useAudioPlayerControl } from './app/composables/useAudioPlayerControl'; export { useAudioPlayerSync } from './app/composables/useAudioPlayerSync'; export { useSchedulePlaylistSync, notifySchedulePlaylistChanged } from './app/composables/useSchedulePlaylistSync'", resolveDir: root },
  bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.client': 'false', 'import.meta.server': 'false' },
  plugins: [{ name: '播放器外部依赖', setup(builder) {
    builder.onResolve({ filter: /^(~\/|\.\/use(?:Auth|LocaleText)$)/ }, (args) => {
      const path = args.path.startsWith('./') ? '~/composables/' + args.path.slice(2) : args.path
      return path in dependencies
        ? { path, namespace: 'fixture' }
        : { path: resolve(root, 'app', path.slice(2) + '.ts') }
    })
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: dependencies[args.path], loader: 'js' }))
  }}]
})
const module = { exports: {} as { useAudioPlayer: typeof useAudioPlayer; useAudioPlayerControl: typeof useAudioPlayerControl; useAudioPlayerSync: typeof useAudioPlayerSync; useSchedulePlaylistSync: typeof useSchedulePlaylistSync; notifySchedulePlaylistChanged: typeof notifySchedulePlaylistChanged } }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
const authUser = ref<{ id: number; role: string } | null>({ id: 1, role: 'SUPER_ADMIN' })
Object.assign(globalThis, { window: { navigator: { userAgent: '播放器测试' }, $showNotification() {} }, __resolveScheduleTestMusic: async () => '/audio/resolved.wav', __scheduleSyncTestAuth: { user: authUser, getAuthConfig: () => ({}) } })
const player = module.exports.useAudioPlayer()
const control = module.exports.useAudioPlayerControl()
const sync = module.exports.useAudioPlayerSync()
const source = { date: '2026-10-20', playTimeId: 1, includeDrafts: true }
const item = (id: number, row = id) => ({
  id: row, playDate: source.date, playTimeId: 1,
  song: { id, title: `测试${id}`, artist: '测试', musicUrl: `/audio/${id}.wav`, playUrl: `/audio/${id}.wav` }
})
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const start = (items = [item(1), item(2), item(3)]) => {
  player.stopSong()
  player.playScheduleSong(items[1].song, items, source, 1)
}

const renderer = createRenderer<object, object>({
  insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}),
  createComment: () => ({}), setText() {}, setElementText() {},
  parentNode: () => null, nextSibling: () => null, patchProp() {}
})
const mountScheduleSync = () => {
  const app = renderer.createApp({
    setup() {
      module.exports.useSchedulePlaylistSync()
      return () => null
    }
  })
  app.mount({})
  return app
}

test('刷新保留音频对象、进度和暂停状态，恢复后使用新队列位置', async () => {
  start()
  const original = player.getCurrentSong().value
  player.setDuration(100)
  player.setPosition(37)
  player.pauseSong()
  player.syncSchedulePlaylist([item(3, 103), item(2, 102), item(1, 101)])
  assert.equal(player.getCurrentSong().value, original)
  assert.equal(player.getCurrentPosition().value, 37)
  assert.equal(player.getPlayingStatus().value, false)
  assert.equal(player.getCurrentPlaylistIndex().value, 1)
  player.resumeSong()
  await player.playNext()
  assert.equal(player.getCurrentSong().value?.id, 1)
})

test('非空排期移除当前曲，播完衔接旧后续且支持手动上一首', async () => {
  start()
  player.syncSchedulePlaylist([item(1, 101), item(4, 104), item(3, 103)])
  assert.equal(player.getCurrentPlaylistIndex().value, -1)
  player.handleScheduleEnded('order')
  await flush()
  assert.equal(player.getCurrentSong().value?.id, 3)
  start()
  player.syncSchedulePlaylist([item(1, 101), item(4, 104), item(3, 103)])
  await player.playPrevious()
  assert.equal(player.getCurrentSong().value?.id, 1)
})

test('自然暂停事件保留空排期等待，补歌后从新列表头自动续播', async () => {
  start()
  player.syncSchedulePlaylist([])
  control.onPause()
  player.pauseSong(false)
  control.setPlayMode('order')
  control.onEnded()
  assert.equal(player.scheduleWaiting.value, true)
  player.syncSchedulePlaylist([item(4), item(1)])
  await flush()
  assert.equal(player.getCurrentSong().value?.id, 4)
  assert.equal(player.getPlayingStatus().value, true)
})

test('当前曲尚未结束时补歌，保持音频并在结束后衔接', async () => {
  start()
  player.syncSchedulePlaylist([])
  player.syncSchedulePlaylist([item(4), item(3)])
  assert.equal(player.getCurrentSong().value?.id, 2)
  player.handleScheduleEnded('order')
  await flush()
  assert.equal(player.getCurrentSong().value?.id, 4)
})

test('清空后补入需解析音源的歌曲，保存刷新重建记录后首次下一首仍成功', async () => {
  let resolveMusic!: (url: string) => void
  Object.assign(globalThis, { __resolveScheduleTestMusic: () => new Promise<string>((resolve) => { resolveMusic = resolve }) })
  const slow = { ...item(4), song: { ...item(4).song, musicUrl: null, playUrl: null, musicPlatform: 'netease', musicId: '4' } }
  start()
  player.syncSchedulePlaylist([])
  player.syncSchedulePlaylist([slow])
  assert.equal(player.hasNext.value, true)
  const navigation = player.playNext()
  await flush()
  player.syncSchedulePlaylist([{ ...slow, id: 104, song: { ...slow.song } }])
  resolveMusic('/audio/4.wav')
  assert.equal(await navigation, true)
  assert.equal(player.getCurrentSong().value?.id, 4)
})

test('清空补歌后的切歌解析不受当前曲元数据更新影响', async () => {
  let resolveMusic!: (url: string) => void
  Object.assign(globalThis, { __resolveScheduleTestMusic: () => new Promise<string>((resolve) => { resolveMusic = resolve }) })
  const slow = { ...item(4), song: { ...item(4).song, musicUrl: null, playUrl: null, musicPlatform: 'netease', musicId: '4' } }
  start()
  player.syncSchedulePlaylist([])
  player.syncSchedulePlaylist([slow])
  const navigation = player.playNext()
  await flush()
  player.updateCurrentSong({ ...player.getCurrentSong().value!, cover: '/new-cover.jpg' })
  resolveMusic('/audio/4.wav')
  assert.equal(await navigation, true)
  assert.equal(player.getCurrentSong().value?.id, 4)
})

test('主动暂停和关闭取消自动续播；暂停后可以手动恢复新队列', async () => {
  start()
  player.syncSchedulePlaylist([])
  player.handleScheduleEnded('order')
  await control.togglePlay()
  player.syncSchedulePlaylist([item(4)])
  await flush()
  assert.equal(player.getPlayingStatus().value, false)
  assert.equal(player.getCurrentSong().value?.id, 2)
  player.resumeSong()
  await flush()
  assert.equal(player.getCurrentSong().value?.id, 4)
  player.stopSong()
  assert.equal(player.scheduleSource.value, null)
  assert.equal(player.getCurrentPlaylist().value.length, 0)
})

test('单曲循环仅循环仍存在的当前项，播完退出不等待补歌', async () => {
  start()
  assert.equal(player.handleScheduleEnded('loopOne'), false)
  player.syncSchedulePlaylist([item(1), item(3)])
  assert.equal(player.handleScheduleEnded('loopOne'), true)
  await flush()
  assert.equal(player.getCurrentSong().value?.id, 3)
  start()
  player.syncSchedulePlaylist([])
  player.handleScheduleEnded('off')
  player.syncSchedulePlaylist([item(4)])
  await flush()
  assert.equal(player.getPlayingStatus().value, false)
  assert.equal(player.scheduleWaiting.value, false)
})

test('列表结束后手动恢复会重播当前项，同歌连续排期使用新的加载标识', async () => {
  start()
  await player.playNext()
  const key = player.getCurrentSong().value?.schedulePlaybackKey
  player.handleScheduleEnded('order')
  player.resumeSong()
  await flush()
  assert.equal(player.getPlayingStatus().value, true)
  assert.equal(player.getCurrentSong().value?.id, 3)
  assert.notEqual(player.getCurrentSong().value?.schedulePlaybackKey, key)
  const repeated = [item(1), item(1, 11)]
  player.playScheduleSong(repeated[0].song, repeated, source, 0)
  const firstKey = player.getCurrentSong().value?.schedulePlaybackKey
  await player.playNext()
  assert.equal(player.getCurrentPlaylistIndex().value, 1)
  assert.notEqual(player.getCurrentSong().value?.schedulePlaybackKey, firstKey)
})

test('未保存列表延迟绑定，同歌不同排期和不同来源不误判为当前项', () => {
  const items = [item(1), item(1, 11), item(3)]
  player.playScheduleSong(items[0].song, items, { ...source, pending: true }, 0)
  player.syncSchedulePlaylist([])
  assert.equal(player.getCurrentPlaylist().value.length, 3)
  assert.equal(player.isCurrentScheduleItem(items[1], source), false)
  assert.equal(player.isCurrentScheduleItem(items[0], { ...source, playTimeId: 'all' }), false)
  player.activateScheduleBinding()
  assert.equal(player.scheduleSource.value?.pending, false)
  player.syncSchedulePlaylist([item(1, 21), item(1, 22), item(3)])
  assert.equal(player.getCurrentPlaylistIndex().value, -1)
  player.playSong(item(4).song)
  assert.equal(player.scheduleSource.value, null)
})

test('异步解析期间重排时采用最新目标，切换来源或主动暂停取消旧结果', async () => {
  const pending: ((url: string) => void)[] = []
  Object.assign(globalThis, { __resolveScheduleTestMusic: () => new Promise<string>((resolve) => pending.push(resolve)) })
  const slow = { ...item(3), song: { ...item(3).song, musicUrl: null, playUrl: null, musicPlatform: 'netease', musicId: '3' } }
  for (const action of ['reorder', 'source', 'pause']) {
    start([item(1), item(2), slow] as ReturnType<typeof item>[])
    const navigation = player.playNext()
    await flush()
    if (action === 'reorder') player.syncSchedulePlaylist([item(1), item(2), item(4), slow])
    else if (action === 'source') player.playSong(item(4).song)
    else player.pauseSong()
    pending.shift()!('/audio/3.wav')
    assert.equal(await navigation, action === 'reorder')
    assert.equal(player.getCurrentSong().value?.id, action === 'pause' ? 2 : 4)
  }
  player.stopSong()
})

test('清空补歌后连续点击下一首与自然结束共用一次音源解析', async () => {
  let resolveMusic!: (url: string) => void
  let requests = 0
  Object.assign(globalThis, { __resolveScheduleTestMusic: () => {
    requests++
    return new Promise<string>((resolve) => { resolveMusic = resolve })
  } })
  const slow = { ...item(4), song: { ...item(4).song, musicUrl: null, playUrl: null, musicPlatform: 'netease', musicId: '4' } }
  start()
  player.syncSchedulePlaylist([])
  player.syncSchedulePlaylist([slow, item(3)])
  const first = player.playNext()
  await flush()
  const second = player.playNext()
  player.handleScheduleEnded('order')
  await flush()
  assert.equal(requests, 1)
  resolveMusic('/audio/4.wav')
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.equal(player.getCurrentSong().value?.id, 4)
  assert.equal(player.getCurrentPlaylistIndex().value, 0)
  player.stopSong()
})

test('自然结束后的待解析目标被重排时，继续衔接最新目标而不滞留旧曲', async () => {
  let resolveMusic!: (url: string) => void
  Object.assign(globalThis, { __resolveScheduleTestMusic: () => new Promise<string>((resolve) => { resolveMusic = resolve }) })
  const slow = { ...item(3), song: { ...item(3).song, musicUrl: null, playUrl: null, musicPlatform: 'netease', musicId: '3' } }
  start([item(1), item(2), slow] as ReturnType<typeof item>[])
  player.handleScheduleEnded('order')
  await flush()
  player.syncSchedulePlaylist([item(1), item(2), item(4), slow])
  resolveMusic('/audio/3.wav')
  await flush()
  assert.equal(player.getCurrentSong().value?.id, 4)
  assert.equal(player.getPlayingStatus().value, true)
  player.stopSong()
})

const unresolved = (id: number) => ({
  ...item(id), song: { ...item(id).song, musicUrl: null, playUrl: null, musicPlatform: 'netease', musicId: String(id) }
})

for (const direction of [1, -1] as const) {
  const label = direction === 1 ? '下一首' : '上一首'
  test(`${label}跳过失败项后，后续候选解析期间重排仍选择最新目标`, async () => {
    for (const rejection of [false, true]) {
      let settle!: (url: string | null) => void
      let rejectMusic!: (error: Error) => void
      Object.assign(globalThis, { __resolveScheduleTestMusic: (_platform: string, id: string) => {
        if (id === '2') return Promise.resolve(null)
        return new Promise<string | null>((resolve, reject) => { settle = resolve; rejectMusic = reject })
      } })
      const first = item(1), failed = unresolved(2), slow = unresolved(3)
      const queue = direction === 1 ? [first, failed, slow] : [slow, failed, first]
      player.stopSong()
      player.playScheduleSong(first.song, queue, source, direction === 1 ? 0 : 2)
      const navigation = direction === 1 ? player.playNext() : player.playPrevious()
      await flush()
      player.syncSchedulePlaylist(direction === 1 ? [first, item(4), slow] : [slow, item(4), first])
      if (rejection) rejectMusic(new Error('旧目标解析失败'))
      else settle('/audio/3.wav')
      assert.equal(await navigation, true)
      assert.equal(player.getCurrentSong().value?.id, 4)
      player.stopSong()
    }
  })

  test(`${label}正常跳过失败项，ID 重建不重复解析已失败音源`, async () => {
    let settle!: (url: string) => void
    const requests: string[] = []
    Object.assign(globalThis, { __resolveScheduleTestMusic: (_platform: string, id: string) => {
      requests.push(id)
      if (id === '2') return Promise.resolve(null)
      return new Promise<string>((resolve) => { settle = resolve })
    } })
    const first = item(1), failed = unresolved(2), slow = unresolved(3)
    const queue = direction === 1 ? [first, failed, slow] : [slow, failed, first]
    player.stopSong()
    player.playScheduleSong(first.song, queue, source, direction === 1 ? 0 : 2)
    const navigation = direction === 1 ? player.playNext() : player.playPrevious()
    await flush()
    player.syncSchedulePlaylist(queue.map(entry => ({ ...entry, id: Number(entry.id) + 100, song: { ...entry.song } })))
    settle('/audio/3.wav')
    assert.equal(await navigation, true)
    assert.equal(player.getCurrentSong().value?.id, 3)
    assert.deepEqual(requests, ['2', '3'])
    player.stopSong()
  })

  test(`${label}重排保留失败前缀时不重复解析，也不产生导航自等待`, async () => {
    let settle!: (url: string) => void
    const requests: string[] = []
    Object.assign(globalThis, { __resolveScheduleTestMusic: (_platform: string, id: string) => {
      requests.push(id)
      if (id === '2') return Promise.resolve(null)
      return new Promise<string>((resolve) => { settle = resolve })
    } })
    const first = item(1), failed = unresolved(2), slow = unresolved(3)
    player.stopSong()
    player.playScheduleSong(first.song, direction === 1 ? [first, failed, slow] : [slow, failed, first], source, direction === 1 ? 0 : 2)
    const navigation = direction === 1 ? player.playNext() : player.playPrevious()
    await flush()
    player.syncSchedulePlaylist(direction === 1 ? [first, failed, item(4), slow] : [slow, item(4), failed, first])
    settle('/audio/3.wav')
    assert.equal(await navigation, true)
    assert.equal(player.getCurrentSong().value?.id, 4)
    assert.deepEqual(requests, ['2', '3'])
    player.stopSong()
  })

  test(`${label}失败项更新音源后重新作为最新候选`, async () => {
    let settle!: (url: string) => void
    Object.assign(globalThis, { __resolveScheduleTestMusic: (_platform: string, id: string) => id === '2'
      ? Promise.resolve(null)
      : new Promise<string>((resolve) => { settle = resolve }) })
    const first = item(1), failed = unresolved(2), slow = unresolved(3)
    player.stopSong()
    player.playScheduleSong(first.song, direction === 1 ? [first, failed, slow] : [slow, failed, first], source, direction === 1 ? 0 : 2)
    const navigation = direction === 1 ? player.playNext() : player.playPrevious()
    await flush()
    const updated = { ...failed, song: { ...failed.song, playUrl: '/audio/repaired.wav' } }
    player.syncSchedulePlaylist(direction === 1 ? [first, updated, slow] : [slow, updated, first])
    settle('/audio/3.wav')
    assert.equal(await navigation, true)
    assert.equal(player.getCurrentSong().value?.id, 2)
    assert.equal(player.getCurrentSong().value?.musicUrl, '/audio/repaired.wav')
    player.stopSong()
  })

  for (const action of ['pause', 'stop', 'source'] as const) {
    test(`${label}解析期间主动 ${action}，包装层不提示播放失败`, async (t) => {
      let settle!: (url: string) => void
      Object.assign(globalThis, { __resolveScheduleTestMusic: () => new Promise<string>((resolve) => { settle = resolve }) })
      const notices: string[] = []
      t.mock.method(window, '$showNotification', (message: string) => notices.push(message))
      const first = item(1), slow = unresolved(3)
      const queue = direction === 1 ? [first, slow] : [slow, first]
      player.stopSong()
      player.playScheduleSong(first.song, queue, source, direction === 1 ? 0 : 1)
      const navigation = direction === 1 ? sync.playNext() : sync.playPrevious()
      await flush()
      if (action === 'pause') player.pauseSong()
      else if (action === 'stop') player.stopSong()
      else player.playSong(item(4).song)
      settle('/audio/3.wav')
      assert.equal((await navigation).success, false)
      assert.equal(player.getCurrentSong().value?.id ?? null, action === 'stop' ? null : action === 'source' ? 4 : 1)
      assert.equal(player.getPlayingStatus().value, action === 'source')
      assert.deepEqual(notices, [])
      player.stopSong()
    })
  }

  test(`${label}连续三次真实解析失败仍停止并提示`, async (t) => {
    const notices: string[] = []
    const requests: string[] = []
    t.mock.method(window, '$showNotification', (message: string) => notices.push(message))
    Object.assign(globalThis, { __resolveScheduleTestMusic: (_platform: string, id: string) => {
      requests.push(id)
      return Promise.resolve(null)
    } })
    const first = item(1)
    const queue = direction === 1
      ? [first, unresolved(2), unresolved(3), unresolved(4), item(5)]
      : [item(5), unresolved(4), unresolved(3), unresolved(2), first]
    player.stopSong()
    player.playScheduleSong(first.song, queue, source, direction === 1 ? 0 : 4)
    assert.equal((await (direction === 1 ? sync.playNext() : sync.playPrevious())).success, false)
    assert.deepEqual(requests, ['2', '3', '4'])
    assert.equal(player.getPlayingStatus().value, false)
    assert.ok(notices.includes('连续失败'))
    player.stopSong()
  })

  test(`${label}重排后新导航接管旧解析，旧导航不再提示失败`, async (t) => {
    let settle!: (url: string) => void
    const notices: string[] = []
    t.mock.method(window, '$showNotification', (message: string) => notices.push(message))
    Object.assign(globalThis, { __resolveScheduleTestMusic: () => new Promise<string>((resolve) => { settle = resolve }) })
    const first = item(1), slow = unresolved(3)
    player.stopSong()
    player.playScheduleSong(first.song, direction === 1 ? [first, slow] : [slow, first], source, direction === 1 ? 0 : 1)
    const oldNavigation = direction === 1 ? sync.playNext() : sync.playPrevious()
    await flush()
    player.syncSchedulePlaylist(direction === 1 ? [first, item(4), slow] : [slow, item(4), first])
    const latestNavigation = direction === 1 ? sync.playNext() : sync.playPrevious()
    settle('/audio/3.wav')
    assert.equal((await oldNavigation).success, false)
    assert.equal((await latestNavigation).success, true)
    assert.equal(player.getCurrentSong().value?.id, 4)
    assert.deepEqual(notices, [])
    player.stopSong()
  })
}

test('协调器不追踪远端变更和空闲时间，只在本标签页保存后刷新', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let saved = [item(1), item(2), item(3)]
  let calls = 0
  Object.assign(globalThis, { $fetch: async () => { calls++; return { data: { schedules: saved } } } })
  start()
  player.setDuration(100)
  player.setPosition(37)
  player.pauseSong()
  const app = mountScheduleSync()
  try {
    await flush()
    assert.equal(calls, 1)
    saved = [item(1), item(2), item(4)]
    t.mock.timers.tick(120_000)
    await flush()
    assert.equal(calls, 1)
    assert.equal(player.getCurrentPlaylist().value[2].song.id, 3)
    module.exports.notifySchedulePlaylistChanged({ dates: ['2026-10-21'] })
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date], playTimeId: 2 })
    await flush()
    assert.equal(calls, 1)
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date], playTimeId: 1 })
    await flush()
    assert.equal(calls, 2)
    assert.equal(player.getCurrentPlaylist().value[2].song.id, 4)
    assert.equal(player.getPlayingStatus().value, false)
    assert.equal(player.getCurrentPosition().value, 37)
    t.mock.timers.tick(120_000)
    await flush()
    assert.equal(calls, 2)
  } finally { app.unmount(); player.stopSong() }
})

test('空排期等待期间不读取远端补歌，本标签页保存补歌后才续播', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let saved = [item(1), item(2), item(3)]
  let calls = 0
  Object.assign(globalThis, { $fetch: async () => { calls++; return { data: { schedules: saved } } } })
  start()
  const app = mountScheduleSync()
  try {
    await flush()
    saved = []
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date] })
    await flush()
    player.handleScheduleEnded('order')
    assert.equal(player.scheduleWaiting.value, true)
    saved = [item(4)]
    t.mock.timers.tick(120_000)
    await flush()
    assert.equal(calls, 2)
    assert.equal(player.scheduleWaiting.value, true)
    assert.equal(player.getCurrentSong().value?.id, 2)
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date] })
    await flush()
    assert.equal(calls, 3)
    assert.equal(player.getCurrentSong().value?.id, 4)
    assert.equal(player.getPlayingStatus().value, true)
  } finally { app.unmount(); player.stopSong() }
})

test('全部时段绑定响应本标签页任一时段保存', async () => {
  let saved = [item(1), item(2), item(3)]
  let calls = 0
  Object.assign(globalThis, { $fetch: async () => { calls++; return { data: { schedules: saved } } } })
  player.stopSong()
  player.playScheduleSong(saved[1].song, saved, { ...source, playTimeId: 'all' }, 1)
  const original = player.getCurrentSong().value
  const app = mountScheduleSync()
  try {
    await flush()
    saved = [...saved, { ...item(4), playTimeId: 2 }]
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date], playTimeId: 2 })
    await flush()
    assert.equal(calls, 2)
    assert.equal(player.getCurrentPlaylist().value[3].song.id, 4)
    assert.equal(player.getCurrentSong().value, original)
  } finally { app.unmount(); player.stopSong() }
})

test('临时排期不读取，只有本标签页原范围保存后才激活并读取一次', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0
  Object.assign(globalThis, { $fetch: async () => { calls++; return { data: { schedules: [item(1), item(2), item(4)] } } } })
  const items = [item(1), item(2), item(3)]
  player.stopSong()
  player.playScheduleSong(items[1].song, items, { ...source, pending: true }, 1)
  const app = mountScheduleSync()
  try {
    t.mock.timers.tick(120_000)
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date], playTimeId: 2 })
    await flush()
    assert.equal(calls, 0)
    assert.equal(player.scheduleSource.value?.pending, true)
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date], playTimeId: 1 })
    await flush()
    assert.equal(calls, 1)
    assert.equal(player.scheduleSource.value?.pending, false)
    assert.equal(player.getCurrentPlaylist().value[2].song.id, 4)
  } finally { app.unmount(); player.stopSong() }
})

test('本标签页身份变化取消旧读取，卸载后保存通知不再触发读取', async (t) => {
  let settle!: (value: { data: { schedules: ReturnType<typeof item>[] } }) => void
  let calls = 0
  const notices: string[] = []
  t.mock.method(window, '$showNotification', (message: string) => notices.push(message))
  Object.assign(globalThis, { $fetch: () => { calls++; return new Promise(resolve => { settle = resolve }) } })
  start()
  const app = mountScheduleSync()
  try {
    authUser.value = null
    settle({ data: { schedules: [item(4)] } })
    await flush()
    assert.equal(player.scheduleSource.value, null)
    assert.equal(player.getCurrentPlaylist().value.length, 0)
    assert.deepEqual(notices, ['身份变化'])
  } finally { app.unmount(); player.stopSong(); authUser.value = { id: 1, role: 'SUPER_ADMIN' } }
  module.exports.notifySchedulePlaylistChanged({ dates: [source.date] })
  await flush()
  assert.equal(calls, 1)
})

test('本页队列读取失败保留队列并本地化提示，不重试或提示恢复', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let broken = true
  let calls = 0
  const notices: string[] = []
  t.mock.method(window, '$showNotification', (message: string) => notices.push(message))
  Object.assign(globalThis, { $fetch: async () => {
    calls++
    if (broken) throw Object.assign(new Error('读取失败'), { statusCode: 503 })
    return { data: { schedules: [item(1), item(2), item(4)] } }
  } })
  start()
  const app = mountScheduleSync()
  try {
    await flush()
    assert.deepEqual(notices, ['队列更新失败'])
    assert.equal(player.getCurrentPlaylist().value[2].song.id, 3)
    t.mock.timers.tick(120_000)
    await flush()
    assert.equal(calls, 1)
    broken = false
    module.exports.notifySchedulePlaylistChanged({ dates: [source.date] })
    await flush()
    assert.equal(calls, 2)
    assert.equal(player.getCurrentPlaylist().value[2].song.id, 4)
    assert.deepEqual(notices, ['队列更新失败'])
  } finally { app.unmount(); player.stopSong() }
})
