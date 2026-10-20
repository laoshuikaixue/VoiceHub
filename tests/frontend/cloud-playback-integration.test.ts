import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const root = path.resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)

function qualityNotificationHarness() {
  const { parse, compileScript } = require('vue/compiler-sfc')
  const { descriptor } = parse(readFileSync(path.join(root, 'app/components/UI/AudioPlayer.vue'), 'utf8'))
  const script = compileScript(descriptor, { id: 'quality-notification' })
  const declaration = script.scriptSetupAst.flatMap(node => node.declarations || [])
    .find(node => node.id.name === 'reloadNeteaseVersion')
  const notifications: unknown[][] = []
  const props = { song: { id: 'A' } }
  const state = { generation: 0, success: true, finish: null as null | (() => void), deferred: false }
  const control = {
    loadSong: async () => {
      state.generation++
      if (state.deferred) await new Promise<void>(resolve => { state.finish = resolve })
      return state.success
    },
    getLoadGeneration: () => state.generation,
    isPlaying: { value: true }, hasError: { value: false },
    lastLoadError: { value: null as null | { name: string } }
  }
  const isCloudPlayback = { value: false }
  const currentQualityText = { value: 'HQ极高' }
  const context = vm.createContext({
    props, control, isCloudPlayback, currentQualityText,
    isFallbackHandling: { value: false }, closeQualitySettings: () => {},
    sync: { syncPlayStateToGlobal: () => {} }, handleError: async () => {},
    t: (key: string, _fallback = '', label = '') => key === 'qualitySwitched' ? `已切换到${label}` : '云盘原文件',
    window: { $showNotification: (...args: unknown[]) => notifications.push(args) }
  })
  const reload = new vm.Script(`(${descriptor.scriptSetup.content.slice(declaration.init.start, declaration.init.end)})`)
    .runInContext(context) as (options: object) => Promise<void>
  return { reload, state, props, control, notifications, isCloudPlayback, currentQualityText }
}

test('音质提示：成功后使用实际音质，切回云盘显示原文件', async () => {
  const harness = qualityNotificationHarness()
  await harness.reload({ neteaseMode: 'catalog', quality: 2 })
  assert.deepEqual(harness.notifications, [['已切换到HQ极高', 'success', true, 3000]])
  harness.isCloudPlayback.value = true
  await harness.reload({ neteaseMode: 'cloud' })
  assert.equal(harness.notifications[1][0], '已切换到云盘原文件')
})

test('音质提示：失败或取消不显示成功提示', async () => {
  for (const error of [null, { name: 'AbortError' }]) {
    const harness = qualityNotificationHarness()
    harness.state.success = false
    harness.control.lastLoadError.value = error
    await harness.reload({ neteaseMode: 'catalog', quality: 5 })
    assert.equal(harness.notifications.length, 0)
  }
})

test('音质提示：快速切换或切歌后旧请求完成不显示提示', async () => {
  for (const changeSong of [false, true]) {
    const harness = qualityNotificationHarness()
    harness.state.deferred = true
    const loading = harness.reload({ neteaseMode: 'catalog', quality: 2 })
    if (changeSong) harness.props.song = { id: 'B' }
    else harness.state.generation++
    harness.state.finish?.()
    await loading
    assert.equal(harness.notifications.length, 0)
  }
})
async function load(entry: string, mocks: Record<string, string>, state: any) {
  const output = await build({
    entryPoints: [path.join(root, entry)], bundle: true, write: false, platform: 'node', format: 'cjs',
    external: ['vue'], define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
    plugins: [{ name: '播放依赖替身', setup(builder) {
      builder.onResolve({ filter: /^(~\/|\.\/)/ }, args => mocks[args.path]
        ? { path: args.path, namespace: 'mock' }
        : args.path.startsWith('~/') ? { path: path.join(root, 'app', args.path.slice(2)) + '.ts' } : null)
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'ts' }))
    } }]
  })
  const module = { exports: {} as any }
  const context = vm.createContext({ module, exports: module.exports, require, __state: state,
    setTimeout, clearTimeout, performance, AbortController, AbortSignal, DOMException, URL, console,
    ref: require('vue').ref, computed: require('vue').computed, readonly: require('vue').readonly,
    $fetch: (...args: any[]) => state.fetch(...args),
    localStorage: { getItem: (key: string) => key === 'netease_vip' ? '1' : key === 'netease_cookie' ? state.cookie || '测试会话' : null },
    window: { $showNotification: (...args: any[]) => state.notifications?.push(args), localStorage: { getItem: (key: string) => key === 'netease_vip' ? '1' : key === 'netease_cookie' ? state.cookie || '测试会话' : null } }
  })
  new vm.Script(output.outputFiles[0].text).runInContext(context)
  return module.exports
}

const commonMocks = {
  '~/composables/useAudioQuality': 'export const useAudioQuality=()=>({getQuality:()=>4,getQualityLabel:()=>"HQ",getQualityOptions:()=>[],saveQuality:()=>{}})',
  '~/composables/useLocaleText': 'export const useServerErrors=()=>({localize:()=>"错误"}); export const useLocaleText=()=>({t:()=>"提示"})'
}
const coreMocks = {
  ...commonMocks,
  '~/composables/useMusicSources': 'export const useMusicSources=()=>({getSongUrl:async (...args)=>{__state.catalogCalls++;__state.options=args[4];return {success:true,url:"https://catalog.example/file",source:"netease-backup",actualQuality:"exhigh"}}})',
  '~/composables/useNeteaseCloudPlayback': 'export const useNeteaseCloudPlayback=()=>({resolve:async(id,options)=>{__state.cloudCalls++;if(options?.neteaseMode==="catalog")return null;return __state.cloud()}})',
  '~/composables/useChkszSource': 'export const useChkszSource=()=>({hasChkszKey:()=>false,getChkszMusicUrl:async()=>null})',
  '~/utils/musicSources': 'export const getVkeysIdParam=()=>({key:"id",value:"1"})',
  '~/utils/bilibiliSource': 'export const parseBilibiliId=x=>({bvid:x})',
  '~/utils/pluginPlatform': 'export const isPluginPlatform=()=>false',
  '~/utils/invalidPlaybackUrls': 'export const isPlaybackUrlInvalid=()=>false',
  '~/utils/qqCookie': 'export const QQ_MUSIC_COOKIE_KEY="qq";export const persistQqMusicCookie=()=>{};export const clearQqMusicLoginState=()=>{}',
  '~/utils/pluginResolver': 'export const resolvePluginUrl=async()=>{__state.pluginCalls++;return null}'
}

test('统一解析：云盘先于已有播放 URL 和第三方，实际文件信息完整返回', async () => {
  const state = { cloudCalls: 0, catalogCalls: 0, pluginCalls: 0, cloud: async () => ({url:'https://cloud.example/original',source:'netease-cloud',actualQuality:'cloud',cloudFile:{key:'文件A'}}) }
  const { getMusicUrlResult } = await load('app/utils/musicUrl.ts', coreMocks, state)
  const result = await getMusicUrlResult('netease', '10001', 'https://catalog.example/stale')
  assert.equal(result.url, 'https://cloud.example/original')
  assert.equal(result.cloudFile.key, '文件A')
  assert.equal(state.catalogCalls, 0)
  assert.equal(state.pluginCalls, 0)
})

test('统一解析：已命中云盘后失败直接结束，禁止公开版、插件和第三方回退', async () => {
  const state = { cloudCalls: 0, catalogCalls: 0, pluginCalls: 0, cloud: async () => { throw Object.assign(new Error('失败'), { data: {code:'MUSIC_CLOUD_PLAYBACK_FAILED'} }) } }
  const { getMusicUrlResult } = await load('app/utils/musicUrl.ts', coreMocks, state)
  await assert.rejects(getMusicUrlResult('netease', '10001'))
  assert.equal(state.catalogCalls, 0)
  assert.equal(state.pluginCalls, 0)
})

test('统一解析：显式公开曲库选择跳过云盘，并保留实际返回音质', async () => {
  const state = { cloudCalls: 0, catalogCalls: 0, pluginCalls: 0, options: null as any, cloud: async () => null }
  const { getMusicUrlResult } = await load('app/utils/musicUrl.ts', coreMocks, state)
  const result = await getMusicUrlResult('netease', '10001', 'https://cloud.example/stale', {neteaseMode:'catalog',quality:4})
  assert.equal(result.actualQuality, 'exhigh')
  assert.equal(state.catalogCalls, 1)
  assert.equal(state.options.skipCloudProbe, true)
  assert.equal(result.url, 'https://catalog.example/file')
  assert.equal(state.cloudCalls, 0)
  assert.equal(state.pluginCalls, 0)
})

test('统一解析：明确所选公开音质失败时，不换其他解析器或音质', async () => {
  const state = {catalogCalls:0,pluginCalls:0}
  const mocks = {...coreMocks,'~/composables/useMusicSources':'export const useMusicSources=()=>({getSongUrl:async()=>{__state.catalogCalls++;throw Object.assign(new Error("不可用"),{data:{code:"MUSIC_CATALOG_QUALITY_UNAVAILABLE"}})}})'}
  const {getMusicUrlResult} = await load('app/utils/musicUrl.ts',mocks,state)
  await assert.rejects(getMusicUrlResult('netease','10001',undefined,{neteaseMode:'catalog',quality:5}), (error:any)=>error.data.code==='MUSIC_CATALOG_QUALITY_UNAVAILABLE')
  assert.equal(state.catalogCalls,1)
  assert.equal(state.pluginCalls,0)
})

const sourceMocks = {
  '~/utils/musicSources': 'const source={id:"netease-backup-1",baseUrl:"/netease"}; export const MUSIC_SOURCE_CONFIG={primarySource:source.id}; export const getEnabledSources=()=>[source]; export const getSourceById=()=>source; export const getVkeysIdParam=()=>({key:"id",value:"10001"})',
  '~/utils/bilibiliSource': 'export const getBilibiliTrackUrl=()=>{}; export const searchBilibili=()=>{}; export const parseBilibiliId=()=>{}',
  '~/utils/lyric/lyricMatchQuality': 'export const evaluateLyricDataMatch=()=>{}',
  '~/utils/invalidPlaybackUrls': 'export const isPlaybackUrlInvalid=()=>false',
  './useLyricSettings': 'export const useLyricSettings=()=>({})',
  './usePlatformConfig': 'export const usePlatformConfig=()=>({enabledPlatforms:{value:["netease"]}})',
  './useLocaleText': commonMocks['~/composables/useLocaleText'],
  '~/utils/locale': 'export const useLocale=()=>({audioPlayer:{value:{}}})',
  './useNeteaseCloudPlayback': 'export const useNeteaseCloudPlayback=()=>({resolve:async()=>null})',
  '~/utils/platforms': 'export const getPlatformDisplayName=()=>"网易云"',
  '~/utils/pluginPlatform': 'export const getPluginId=()=>{};export const getPluginQuality=()=>{};export const isPluginPlatform=()=>false;export const LEGACY_PLUGIN_PLATFORM_PREFIX="musicfree:";export const PLUGIN_PLATFORM_PREFIX="plugin:"',
  '~/utils/neteaseApi': 'export const getLoginStatus=async()=>({})'
}

test('音源管理器：临时 HQ 选择穿过真实映射与曲库解析，不被默认音质覆盖', async () => {
  const requests: any[] = []
  const state = {fetch:async (url:string, options:any)=>{
    requests.push([url,options.params])
    return {code:200,data:[{url:'https://catalog.example/HQ.mp3',level:options.params.cookie === '测试会话'?'hires':'exhigh'}]}
  }}
  const {useMusicSources}=await load('app/composables/useMusicSources.ts',sourceMocks,state)
  const result=await useMusicSources().getSongUrl('10001',4,'netease',undefined,{neteaseMode:'catalog'})
  assert.equal(result.actualQuality,'exhigh')
  assert.equal(requests.length,2)
  assert.ok(requests.every(([url,params])=>url==='/netease/song/url/v1'&&params.level==='exhigh'))
  assert.equal(requests[1][1].cookie,'MUSIC_U=;')
})

test('音源管理器：取链期间更换登录账号后丢弃旧账号的公开音质结果', async () => {
  const state = { cookie: '账号A', fetch: async () => {
    state.cookie = '账号B'
    return { code: 200, data: [{ url: 'https://catalog.example/stale.mp3', level: 'exhigh' }] }
  } }
  const { useMusicSources } = await load('app/composables/useMusicSources.ts', sourceMocks, state)
  await assert.rejects(useMusicSources().getSongUrl('10001', 4, 'netease', undefined, { neteaseMode: 'catalog' }), { name: 'AbortError' })
})

test('音源管理器：明确音质不可用时将专用错误交还播放器，不进入既有降级链', async () => {
  let calls=0
  const state={fetch:async()=>{calls++;return {code:200,data:[{url:'https://catalog.example/other.mp3',level:'exhigh'}]}}}
  const {useMusicSources}=await load('app/composables/useMusicSources.ts',sourceMocks,state)
  await assert.rejects(useMusicSources().getSongUrl('10001',5,'netease',undefined,{neteaseMode:'catalog'}),(error:any)=>error.data.code==='MUSIC_CATALOG_QUALITY_UNAVAILABLE')
  assert.equal(calls,2)
})

class AudioStub extends EventTarget {
  src = ''
  readyState = 4
  paused = true
  volume = 1
  autoplay = false
  preload = ''
  blockAutoplay = false
  getAttribute(name: string) { return name === 'src' ? this.src || null : null }
  pause() { this.paused = true }
  load() {}
  async play() {
    if (this.blockAutoplay) throw new DOMException('需要交互', 'NotAllowedError')
    this.paused = false
    this.dispatchEvent(new Event('play'))
  }
}
async function controlHarness(resolve: (...args: any[]) => Promise<any>) {
  const state = { resolve, paused: false, song: undefined as ReturnType<typeof song> | undefined }
  const mocks = {
    ...commonMocks,
    '~/utils/musicUrl': 'export const getMusicUrlResult=(...args)=>__state.resolve(...args)',
    '~/composables/useLyrics': 'export const useLyrics=()=>({clearLyrics:()=>{}})',
    '~/composables/useAudioPlayer': 'export const useAudioPlayer=()=>({getCurrentSong:()=>({value:__state.song}),pauseSong:()=>{__state.paused=true}})',
    '~/utils/locale': 'export const useLocale=()=>({audioPlayer:{value:{autoplayBlocked:"需要交互"}}})'
  }
  const { useAudioPlayerControl } = await load('app/composables/useAudioPlayerControl.ts', mocks, state)
  const control = useAudioPlayerControl()
  const audio = new AudioStub()
  control.setAudioPlayerRef(audio)
  audio.addEventListener('play', control.onPlay)
  return { control, audio, state }
}
const song = (id: string) => ({id,musicId:id,musicPlatform:'netease',title:id})

test('共享播放入口：网易云先入队再解析，快速选歌不等待云盘文件弹窗', async () => {
  const state = { resolves: 0, playCalls: [] as any[] }
  const mocks = {
    '~/utils/musicUrl': 'export const getMusicUrl=async()=>{__state.resolves++;return "https://catalog.example/file"}',
    '~/utils/bilibiliSource': 'export const isBilibiliSong=s=>s.musicPlatform==="bilibili"',
    './useAudioPlayer': 'export const useAudioPlayer=()=>({isCurrentSong:()=>false,playSong:(...args)=>__state.playCalls.push(args)})',
    './useToast': 'export const useToast=()=>({showToast:()=>{}})',
    '~/utils/locale': 'export const useLocale=()=>({audioPlayer:{value:{}}})'
  }
  const { useSongPlayer } = await load('app/composables/useSongPlayer.ts', mocks, state)
  const player = useSongPlayer()
  await Promise.all([
    player.playSong({ ...song('A'), pc: { id: 200001 }, playUrl: 'https://catalog.example/old' }),
    player.playSong(song('B'))
  ])
  assert.equal(state.resolves, 0)
  assert.equal(state.playCalls[0][0].musicUrl, null)
  assert.equal(state.playCalls[0][0].pc.id, 200001)
  assert.equal(state.playCalls[1][0].musicId, 'B')
  await player.playSong({ ...song('C'), musicPlatform: 'tencent' })
  assert.equal(state.resolves, 1)
  assert.equal(state.playCalls[2][0].musicUrl, 'https://catalog.example/file')
})

const cloudMocks = {
  '~/utils/locale': 'export const useLocale=()=>({audioPlayer:{value:{}}})',
  '~/composables/useLocaleText': commonMocks['~/composables/useLocaleText'],
  '~/composables/useSyncedTime': 'export const getSyncedTimestamp=()=>0'
}
const cloudRecord = (songId = 200001) => ({songId,fileName:'测试.flac',fileSize:4000,simpleSong:{id:10001}})

test('真实云盘组合逻辑：下载使用云盘记录 ID，支持实测顶层 url/size 响应', async () => {
  const requests: any[] = []
  const state = { fetch: async (url: string, options: any) => {
    requests.push([url, options.params])
    return url.endsWith('/user/cloud') ? {code:200,data:[cloudRecord()]} : {code:200,url:'https://cloud.example/file.flac',size:4000}
  } }
  const {useNeteaseCloudPlayback} = await load('app/composables/useNeteaseCloudPlayback.ts', cloudMocks, state)
  const result = await useNeteaseCloudPlayback().resolve('10001')
  assert.equal(result.source, 'netease-cloud')
  assert.equal(requests[1][1].id, '200001')
})

test('真实云盘组合逻辑：查询失败提示后允许曲库回退，不缓存为未命中', async () => {
  let calls = 0
  const state = { notifications: [] as any[], fetch: async () => {
    calls++
    if (calls === 1) throw new Error('网络失败')
    return {code:200,data:[]}
  } }
  const {useNeteaseCloudPlayback} = await load('app/composables/useNeteaseCloudPlayback.ts', cloudMocks, state)
  const cloud = useNeteaseCloudPlayback()
  assert.equal(await cloud.resolve('10001'), null)
  assert.equal(state.notifications.length, 1)
  assert.equal(await cloud.resolve('10001'), null)
  assert.equal(calls, 2)
})

test('真实云盘组合逻辑：命中后的空链接抛出专用错误，禁止当作查询失败', async () => {
  const state = {notifications: [] as any[], fetch: async (url: string) => url.endsWith('/user/cloud')
    ? {code:200,data:[cloudRecord()]} : {code:200,url:null}}
  const {useNeteaseCloudPlayback} = await load('app/composables/useNeteaseCloudPlayback.ts', cloudMocks, state)
  await assert.rejects(useNeteaseCloudPlayback().resolve('10001'), (error: any) => error.data.code === 'MUSIC_CLOUD_PLAYBACK_FAILED')
  assert.equal(state.notifications.length, 0)
})

test('真实云盘组合逻辑：同账号上传失效后，旧取链结果不能恢复生效', async () => {
  let finish: (value: any) => void = () => {}
  let downloads = 0
  const state = { fetch: async (url: string) => {
    if (url.endsWith('/user/cloud')) return { code: 200, data: [cloudRecord()] }
    if (++downloads === 1) return new Promise(resolve => { finish = resolve })
    return { code: 200, url: 'https://cloud.example/current.flac', size: 4000 }
  } }
  const { useNeteaseCloudPlayback, invalidateNeteaseCloud } = await load('app/composables/useNeteaseCloudPlayback.ts', cloudMocks, state)
  const cloud = useNeteaseCloudPlayback()
  const old = cloud.resolve('10001')
  for (let i = 0; i < 20 && !downloads; i++) await Promise.resolve()
  assert.equal(downloads, 1)
  invalidateNeteaseCloud()
  assert.equal((await cloud.resolve('10001')).url, 'https://cloud.example/current.flac')
  finish({ code: 200, url: 'https://cloud.example/stale.flac', size: 4000 })
  await assert.rejects(old, { name: 'AbortError' })
})

test('增强重试：明确选择云盘或公开音质后不自动换音质', async () => {
  const state = { calls: 0 }
  const mocks = {
    './useAudioQuality': 'export const useAudioQuality=()=>({getQuality:()=>4,getQualityOptions:()=>[{value:4,label:"HQ"},{value:6,label:"Hi-Res"}],saveQuality:()=>{__state.calls++}})',
    '~/utils/musicUrl': 'export const getMusicUrlResult=async()=>{__state.calls++;return {url:"https://catalog.example/other"}}'
  }
  const { useAudioPlayerEnhanced } = await load('app/composables/useAudioPlayerEnhanced.ts', mocks, state)
  for (const neteaseMode of ['cloud', 'catalog']) {
    const result = await useAudioPlayerEnhanced().tryQualitySwitch({
      musicPlatform: 'netease', musicId: '10001', sourceInfo: { playbackSelection: { neteaseMode, quality: 4 } }
    })
    assert.equal(result.success, false)
  }
  assert.equal(state.calls, 0)
})

test('真实云盘组合逻辑：多文件预加载不弹窗，手动选定后会话记忆，上传使选择失效', async () => {
  const state = {fetch: async (url: string) => url.endsWith('/user/cloud')
    ? {code:200,data:[cloudRecord(),cloudRecord(200002)]} : {code:200,url:'https://cloud.example/file.flac',size:4000}}
  const {useNeteaseCloudPlayback,invalidateNeteaseCloud} = await load('app/composables/useNeteaseCloudPlayback.ts', cloudMocks, state)
  const cloud = useNeteaseCloudPlayback()
  assert.equal((await cloud.resolve('10001',{preload:true})).url, null)
  assert.equal(cloud.pendingSelection.value, null)
  const pending = cloud.resolve('10001')
  for (let i=0;i<10&&!cloud.pendingSelection.value;i++) await Promise.resolve()
  assert.equal(cloud.pendingSelection.value.files.length, 2)
  cloud.chooseFile(cloud.pendingSelection.value.files[1].key)
  assert.equal((await pending).cloudFile.downloadId, '200002')
  assert.equal((await cloud.resolve('10001')).cloudFile.downloadId, '200002')
  invalidateNeteaseCloud()
  const retry = cloud.resolve('10001')
  for (let i=0;i<10&&!cloud.pendingSelection.value;i++) await Promise.resolve()
  assert.ok(cloud.pendingSelection.value)
  cloud.chooseFile()
  await assert.rejects(retry,{name:'AbortError'})
})

test('播放器：云盘取链失败结束两个 loading，保留错误身份用于禁止换源', async () => {
  const {control} = await controlHarness(async()=>{throw Object.assign(new Error('失败'),{data:{code:'MUSIC_CLOUD_PLAYBACK_FAILED'}})})
  assert.equal(await control.loadSong(song('A')), false)
  assert.equal(control.isLoadingTrack.value, false)
  assert.equal(control.isLoadingNewSong.value, false)
  assert.equal(control.playbackInfo.value.source, 'netease-cloud')
  control.cleanup()
})

test('播放器：快速切歌取消旧请求，旧结果不覆盖新 src 与 loading', async () => {
  let finish: (value: any) => void = () => {}
  const {control,audio} = await controlHarness(async (_, id)=>id==='A'?new Promise(resolve=>{finish=resolve}):{url:'https://cloud.example/B'})
  const old = control.loadSong(song('A'))
  await Promise.resolve()
  assert.equal(await control.loadSong(song('B')), true)
  finish({url:'https://cloud.example/A'})
  assert.equal(await old, false)
  assert.equal(audio.src, 'https://cloud.example/B')
  assert.equal(control.isLoadingTrack.value, false)
  control.cleanup()
})

test('播放器：自动播放受阻结束转圈，保留可手动播放状态', async () => {
  const {control,audio} = await controlHarness(async()=>({url:'https://cloud.example/A'}))
  audio.blockAutoplay = true
  assert.equal(await control.loadSong(song('A')), true)
  assert.equal(control.isLoadingTrack.value, false)
  assert.equal(control.hasError.value, false)
  audio.blockAutoplay = false
  assert.equal(await control.play(), true)
  control.cleanup()
})

test('播放器：取消云盘文件选择不计失败，再点播放重新进入解析', async () => {
  let calls = 0
  const { control, audio, state } = await controlHarness(async () => {
    if (++calls === 1) throw new DOMException('用户取消选择', 'AbortError')
    return { url: 'https://cloud.example/selected.flac', source: 'netease-cloud' }
  })
  state.song = song('A')
  assert.equal(await control.loadSong(state.song), false)
  assert.equal(control.hasError.value, false)
  assert.equal(control.isLoadingTrack.value, false)
  assert.equal(await control.play(), true)
  assert.equal(calls, 2)
  assert.equal(audio.src, 'https://cloud.example/selected.flac')
  control.cleanup()
})

test('播放器：所选音质不可用时保留当前文件、进度、来源及音质选择', async () => {
  const {control,audio} = await controlHarness(async (_,__,___,options)=>{
    if(options.neteaseMode==='catalog') throw Object.assign(new Error('不可用'),{data:{code:'MUSIC_CATALOG_QUALITY_UNAVAILABLE'}})
    return {url:'https://cloud.example/original',source:'netease-cloud',actualQuality:'cloud'}
  })
  await control.loadSong(song('A'))
  audio.currentTime = 42
  assert.equal(await control.loadSong(song('A'),{neteaseMode:'catalog',quality:5}),false)
  assert.equal(audio.src,'https://cloud.example/original')
  assert.equal(audio.currentTime,42)
  assert.equal(audio.paused,false)
  assert.equal(control.playbackInfo.value.actualQuality,'cloud')
  assert.equal(control.getPlaybackOptions().neteaseMode,undefined)
  assert.equal(control.hasError.value,false)
  assert.equal(control.isLoadingTrack.value,false)
  control.cleanup()
})

test('播放器：取消中的音质选择不污染已生效选择，后续失败仍保留云盘', async () => {
  let finish: (value:any)=>void=()=>{}
  const {control,audio}=await controlHarness(async (_,__,___,options)=>{
    if(options.quality===2) return new Promise(resolve=>{finish=resolve})
    if(options.quality===5) throw Object.assign(new Error('不可用'),{data:{code:'MUSIC_CATALOG_QUALITY_UNAVAILABLE'}})
    return {url:'https://cloud.example/original',source:'netease-cloud',actualQuality:'cloud'}
  })
  await control.loadSong(song('A'))
  const pending=control.loadSong(song('A'),{neteaseMode:'catalog',quality:2})
  await Promise.resolve()
  assert.equal(audio.src,'https://cloud.example/original')
  assert.equal(await control.loadSong(song('A'),{neteaseMode:'catalog',quality:5}),false)
  finish({url:'https://catalog.example/stale.mp3',actualQuality:'standard'})
  assert.equal(await pending,false)
  assert.equal(audio.src,'https://cloud.example/original')
  assert.equal(control.getPlaybackOptions().neteaseMode,undefined)
  assert.equal(control.isLoadingTrack.value,false)
  control.cleanup()
})

test('播放器：成功切换使用提交时的最新进度，并保留暂停状态', async () => {
  let finish: (value:any)=>void=()=>{}
  const {control,audio}=await controlHarness(async (_,__,___,options)=>options.quality
    ? new Promise(resolve=>{finish=resolve})
    : {url:'https://cloud.example/original',source:'netease-cloud',actualQuality:'cloud'})
  await control.loadSong(song('A'))
  let src=audio.src
  Object.defineProperty(audio,'src',{get:()=>src,set:value=>{src=value;audio.currentTime=0}})
  audio.currentTime=42
  const pending=control.loadSong(song('A'),{neteaseMode:'catalog',quality:4})
  await Promise.resolve()
  audio.currentTime=44
  control.pause()
  finish({url:'https://catalog.example/HQ.mp3',actualQuality:'exhigh'})
  assert.equal(await pending,true)
  assert.equal(audio.currentTime,44)
  assert.equal(audio.paused,true)
  assert.equal(audio.autoplay,false)
  assert.equal(control.playbackInfo.value.actualQuality,'exhigh')
  control.cleanup()
})
