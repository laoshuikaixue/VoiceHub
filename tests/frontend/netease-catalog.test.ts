import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { computed, reactive, readonly, ref } from 'vue'
import { getNeteaseCatalogResult } from '../../app/utils/neteaseCatalog.ts'
import { readFileSync } from 'node:fs'

const getUrl = (value: unknown, id: string | number = 10001) => getNeteaseCatalogResult(value, id)?.url ?? null

const track = (overrides: Record<string, unknown> = {}) => ({
  id: 10001, level: 'exhigh', url: 'https://audio.example/full.mp3', freeTrialInfo: null, ...overrides
})
const response = (overrides: Record<string, unknown> = {}) => ({ code: 200, data: [track(overrides)] })

test('完整曲库响应保留 URL，兼容字符串 ID 和缺省试听标记', () => {
  assert.equal(getUrl(response(), '10001'), track().url)
  assert.equal(getUrl(response({ id: '10001', freeTrialInfo: undefined })), track().url)
})

test('批量响应按首个请求 ID 取对应歌曲，不依赖返回顺序', () => {
  assert.equal(getUrl({ code: 200, data: [track({ id: 10002, url: 'https://audio.example/other' }), track()] }, '10001,10002'), track().url)
})

for (const level of ['standard', 'lossless', 'hires', undefined]) {
  test(`保留完整文件，实际音质 ${String(level)} 单独返回`, () => {
    const result = getNeteaseCatalogResult(response({ level }), 10001)
    assert.equal(result?.url, track().url)
    assert.equal(result?.actualQuality, level ?? null)
  })
}

for (const level of ['standard', 'lossless', 'hires', undefined, '']) {
  test(`保留完整文件，实际音质 ${String(level)} 单独返回`, () => {
    const result = getNeteaseCatalogResult(response({ level }), 10001)
    assert.equal(result?.url, track().url)
    assert.equal(result?.actualQuality, ['standard', 'lossless', 'hires'].includes(level) ? level : null)
  })
}

for (const freeTrialInfo of [{ start: 0, end: 30 }, {}, '{"start":0,"end":30}']) {
  test(`试听标记 ${JSON.stringify(freeTrialInfo)} 不作为完整播放响应`, () => {
    assert.equal(getUrl(response({ freeTrialInfo })), null)
  })
}

for (const freeTrialInfo of [null, undefined, false, 0, '']) {
  test(`试听标记 ${JSON.stringify(freeTrialInfo)} 视为无试听，保留 URL`, () => {
    assert.equal(getUrl(response({ freeTrialInfo })), track().url)
  })
}

test('曲库未返回目标歌曲时拒绝其他歌曲', () => {
  assert.equal(getUrl(response({ id: 10002 })), null)
  assert.equal(getUrl({ code: 200, data: [track({ id: 10002 }), track({ id: 10003 })] }, '10001'), null)
})

test('单项响应缺省 ID 不错配，解锁链路的批量 ID 保留首曲', () => {
  assert.equal(getUrl(response({ id: undefined })), track().url)
  assert.equal(getUrl(response({ id: null }), '10001,10002'), track().url)
})

test('失败及畸形响应不抛错、不返回 URL', () => {
  for (const value of [null, [], {}, { code: 403, data: [track()] }, { code: 200, data: null }, { code: 200, data: [null] }]) {
    assert.equal(getUrl(value), null)
  }
})

test('拒绝空链接、无效 URL 和非 HTTP 协议，保留既有 HTTP 升级路径', () => {
  for (const url of ['', null, 123, 'not-a-url', 'javascript:alert(1)', 'file:///audio.mp3']) {
    assert.equal(getUrl(response({ url })), null)
  }
  assert.equal(getUrl(response({ url: 'http://audio.example/full.mp3' })), 'http://audio.example/full.mp3')
})

test('SDK 字符串 null 不视为试听，回填的请求音质不视为实测音质', () => {
  const result = getNeteaseCatalogResult(response({ freeTrialInfo: 'null', level: 'exhigh' }), 10001)
  assert.equal(result?.url, track().url)
  assert.equal(result?.actualQuality, null)
})

const root = path.resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
type Request = { url: string; params?: Record<string, unknown> }
type Resolver = { getSongUrl: (id: string, quality: number, platform: string, cookie?: string, options?: { excludeSources?: string[] }) => Promise<{ success: boolean; url?: string; source?: string; actualQuality?: string | null }> }

async function bundleModule<T>(entry: string, fetcher: (request: Request) => unknown, overrides: Record<string, string> = {}, client = false, state: object = {}): Promise<T> {
  const mocks: Record<string, string> = {
    '~/utils/musicSources': 'const sources=[{id:"netease-backup-1",baseUrl:"/netease"},{id:"netease-gdstudio",baseUrl:"/gd"},{id:"vkeys",baseUrl:"/qq"},{id:"bilibili",baseUrl:"/bili"}]; export const MUSIC_SOURCE_CONFIG={primarySource:sources[0].id};export const getEnabledSources=()=>sources;export const getSourceById=id=>sources.find(x=>x.id===id);export const getVkeysIdParam=(platform,id)=>({key:"id",value:id})',
    '~/utils/bilibiliSource': 'export const getBilibiliTrackUrl=async()=>({url:"https://bili.example/audio"});export const searchBilibili=()=>{};export const parseBilibiliId=id=>({bvid:id})',
    '~/utils/lyric/lyricMatchQuality': 'export const evaluateLyricDataMatch=()=>{}',
    '~/utils/invalidPlaybackUrls': 'export const isPlaybackUrlInvalid=()=>false',
    './useLyricSettings': 'export const useLyricSettings=()=>({})',
    './usePlatformConfig': 'export const usePlatformConfig=()=>({enabledPlatforms:{value:["netease","tencent","bilibili"]}})',
    './useLocaleText': 'export const useServerErrors=()=>({localize:()=>"错误"});export const useLocaleText=()=>({t:(key,fallback,requested,actual)=>`请求${requested}，当前音质：${actual}`})',
    '~/utils/locale': 'export const useLocale=()=>({audioPlayer:{value:{}},ui:{value:{audioQuality:{unknown:"音质未知",levels:{standard:"标准",higher:"较高",exhigh:"HQ极高",hires:"Hi-Res"},options:{standard:{label:"标准"},neteaseHq:{label:"HQ极高"},neteaseHiRes:{label:"Hi-Res"}}}}}})',
    '~/utils/platforms': 'export const getPlatformDisplayName=()=>"网易云"',
    '~/utils/pluginPlatform': 'export const getPluginId=()=>{};export const getPluginQuality=x=>x;export const isPluginPlatform=()=>false;export const LEGACY_PLUGIN_PLATFORM_PREFIX="musicfree:";export const PLUGIN_PLATFORM_PREFIX="plugin:"',
    '~/utils/neteaseApi': 'export const getLoginStatus=async()=>({})',
    ...overrides
  }
  const bundle = await build({
    entryPoints: [path.join(root, entry)], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: ['vue'], define: { 'import.meta.client': String(client) },
    plugins: [{ name: '曲库依赖替身', setup(builder) {
      builder.onResolve({ filter: /^(~\/|\.\/)/ }, args => mocks[args.path]
        ? { path: args.path, namespace: 'mock' }
        : args.path.startsWith('~/') ? { path: path.join(root, 'app', args.path.slice(2)) + '.ts' } : null)
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }))
    } }]
  })
  const module = { exports: {} as T }
  const storage = { getItem: (key: string) => key === 'netease_vip' ? '1' : key === 'netease_cookie' ? '测试会话' : null, setItem: () => {}, removeItem: () => {} }
  const context = vm.createContext({ module, exports: module.exports, require, ref, computed, readonly, URL,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    __state: state, localStorage: storage, setTimeout, clearTimeout,
    window: { location: { origin: 'http://localhost:3100' }, localStorage: storage, addEventListener: () => {},
      $showNotification: (...args: unknown[]) => (state as { notifications?: unknown[][] }).notifications?.push(args) },
    $fetch: (url: string, options: { params?: Record<string, unknown> }) => fetcher({ url, params: options?.params }) })
  new vm.Script(bundle.outputFiles[0].text).runInContext(context)
  return module.exports
}

async function sourceHarness(fetcher: (request: Request) => unknown) {
  const module = await bundleModule<{ useMusicSources: () => Resolver }>('app/composables/useMusicSources.ts', fetcher)
  return module.useMusicSources()
}

test('真实取链分支接受正常响应，保持 Cookie、音质请求和 HTTPS 升级', async () => {
  const requests: Request[] = []
  const sources = await sourceHarness(request => { requests.push(request); return response({ url: 'http://audio.example/full.mp3' }) })
  const result = await sources.getSongUrl('10001', 4, 'netease', '测试登录态')
  assert.equal(result.success, true)
  assert.equal(result.url, 'https://audio.example/full.mp3')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].params?.level, 'exhigh')
  assert.equal(requests[0].params?.cookie, '测试登录态')
  assert.equal(requests[0].params?.unblock, false)
})

test('真实取链分支拒绝试听片段，继续原有备用音源', async () => {
  for (const bad of [response({ freeTrialInfo: { start: 0, end: 30 } }), response({ freeTrialInfo: {} })]) {
    const requests: Request[] = []
    const sources = await sourceHarness(request => {
      requests.push(request)
      return request.url === '/netease/song/url/v1' ? bad : { url: 'https://fallback.example/full.mp3' }
    })
    const result = await sources.getSongUrl('10001', 4, 'netease', '测试登录态')
    assert.equal(result.success, true)
    assert.equal(result.source, 'netease-gdstudio')
    assert.equal(result.url, 'https://fallback.example/full.mp3')
    assert.deepEqual(requests.map(request => request.url), ['/netease/song/url/v1', '/gd'])
  }
})

test('原有登录账号可播放的完整云盘文件保留，不强行改取其他版本', async () => {
  for (const freeTrialInfo of [null, 'null']) {
    const requests: Request[] = []
    const sources = await sourceHarness(request => {
      requests.push(request)
      return response({ level: 'hires', type: 'wav', size: 67619020, freeTrialInfo })
    })
    const result = await sources.getSongUrl('10001', 4, 'netease', '测试登录态')
    assert.equal(result.success, true)
    assert.equal(result.url, track().url)
    assert.equal(result.actualQuality, freeTrialInfo === null ? 'hires' : null)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].params?.level, 'exhigh')
  }
})

test('备用音源禁用时，不把被拒绝的官方响应作为成功结果', async () => {
  const sources = await sourceHarness(() => response({ freeTrialInfo: { start: 0, end: 30 } }))
  const result = await sources.getSongUrl('10001', 4, 'netease', '测试登录态', { excludeSources: ['netease-gdstudio'] })
  assert.equal(result.success, false)
  assert.equal(result.url, undefined)
})

test('QQ 与哔哩哔哩原有取链不受网易云响应校验影响', async () => {
  const sources = await sourceHarness(() => ({ code: 200, data: { url: 'https://qq.example/audio' } }))
  assert.equal((await sources.getSongUrl('qq-id', 8, 'tencent')).url, 'https://qq.example/audio')
  assert.equal((await sources.getSongUrl('BVtest', 1, 'bilibili')).url, 'https://bili.example/audio')
})

test('统一解析保留真实音质，按 URL 缓存，预加载其他歌曲不覆盖当前文件', async () => {
  type Core = {
    getMusicUrlResult: (platform: string, id: string) => Promise<{ url: string; actualQuality?: string | null }>
    getCachedMusicUrlQuality: (url: string) => string | null | undefined
  }
  const state = { url: 'https://audio.example/own.wav', actualQuality: 'hires' as string | null | undefined }
  const core = await bundleModule<Core>('app/utils/musicUrl.ts', () => null, {
    '~/composables/useMusicSources': 'export const useMusicSources=()=>({getSongUrl:async()=>({success:true,url:__state.url,actualQuality:__state.actualQuality,source:"netease-backup-1"})})',
    '~/composables/useChkszSource': 'export const useChkszSource=()=>({hasChkszKey:()=>false})',
    '~/utils/pluginResolver': 'export const resolvePluginUrl=async()=>null',
    '~/utils/qqCookie': 'export const persistQqMusicCookie=()=>{};export const clearQqMusicLoginState=()=>{};export const QQ_MUSIC_COOKIE_KEY="qq"'
  }, true, state)
  assert.equal((await core.getMusicUrlResult('netease', '10001')).actualQuality, 'hires')
  assert.equal(core.getCachedMusicUrlQuality(state.url), 'hires')
  state.url = 'https://audio.example/other.mp3'
  state.actualQuality = null
  await core.getMusicUrlResult('netease', '10002')
  assert.equal(core.getCachedMusicUrlQuality(state.url), null)
  assert.equal(core.getCachedMusicUrlQuality('http://audio.example/own.wav'), 'hires')
  state.actualQuality = undefined
  await core.getMusicUrlResult('netease', '10002')
  assert.equal(core.getCachedMusicUrlQuality(state.url), undefined)
  for (let index = 0; index < 201; index++) {
    state.url = `https://audio.example/${index}`
    await core.getMusicUrlResult('netease', String(index + 1))
  }
  assert.equal(core.getCachedMusicUrlQuality('https://audio.example/own.wav'), undefined)
})

test('切换提示仅在返回音质可识别时改用实际音质，未知音质回落请求音质', async () => {
  for (const [actualQuality, label, message] of [
    ['hires', 'Hi-Res', '请求HQ极高，当前音质：Hi-Res'],
    ['exhigh', 'HQ极高', '已切换到HQ极高'],
    [null, 'HQ极高', '已切换到HQ极高'],
    [undefined, 'HQ极高', '已切换到HQ极高'],
    ['vivid', 'HQ极高', '已切换到HQ极高']
  ] as const) {
    const state = { actualQuality, notifications: [] as unknown[][] }
    const module = await bundleModule<{ useAudioPlayerEnhanced: () => { enhancedQualitySwitch: (song: object, quality: number) => Promise<{ success: boolean; qualityLabel: string }> } }>(
      'app/composables/useAudioPlayerEnhanced.ts', () => null, {
        '~/utils/musicUrl': 'export const getMusicUrlResult=async()=>({url:"https://audio.example/own.wav",actualQuality:__state.actualQuality})'
      }, true, state)
    const result = await module.useAudioPlayerEnhanced().enhancedQualitySwitch({ musicPlatform: 'netease', musicId: '10001' }, 4)
    assert.equal(result.success, true)
    assert.equal(result.qualityLabel, label)
    assert.equal(state.notifications[0][0], message)
  }
})

test('播放器与全屏歌词沿用原徽章，仅在返回音质可识别时显示实际音质，不改平台偏好', () => {
  const { parse, compileScript } = require('vue/compiler-sfc')
  for (const file of ['AudioPlayer.vue', 'LyricsModal.vue']) {
    const { descriptor } = parse(readFileSync(path.join(root, 'app/components/UI', file), 'utf8'))
    const script = compileScript(descriptor, { id: 'quality-compat' })
    const declarations = script.scriptSetupAst.flatMap(node => node.declarations || [])
    const actual = ref<string | null | undefined>('hires')
    const control = { isLoadingTrack: ref(false), audioPlayer: ref({ currentSrc: 'https://audio.example/own.wav' }) }
    const currentSong = ref<{ musicPlatform: string; musicUrl?: string }>({ musicPlatform: 'netease' })
    const context = vm.createContext({ computed, props: reactive({ song: currentSong.value }),
      currentSong, control, audioPlayerControl: control, audioPlayer: control.audioPlayer,
      locale: ref({ quality: '音质' }), getQuality: () => 4, getQualityLabel: () => 'HQ极高',
      getCachedMusicUrlQuality: (url: string) => url === 'https://audio.example/new.mp3' ? 'standard' : actual.value,
      getNeteaseQualityLabel: (level: string | null) => ({ hires: 'Hi-Res', standard: '标准', higher: '较高' })[level as string] || null,
      getQualityOptions: () => [{ value: 2, level: 'standard' }, { value: 4, level: 'exhigh' }, { value: 6, level: 'hires' }]
    })
    for (const name of ['reportedQuality', 'actualQualityLabel', 'currentPlatformOptions', 'currentQualityText', 'isCurrentQuality']) {
      const node = declarations.find(item => item.id.name === name).init
      new vm.Script(`var ${name} = (${descriptor.scriptSetup.content.slice(node.start, node.end)})`).runInContext(context)
    }
    assert.equal(vm.runInContext('currentQualityText.value', context), 'Hi-Res')
    assert.equal(vm.runInContext('isCurrentQuality(6)', context), true)
    assert.equal(vm.runInContext('isCurrentQuality(4)', context), false)
    actual.value = null
    assert.equal(vm.runInContext('currentQualityText.value', context), 'HQ极高')
    assert.equal(vm.runInContext('isCurrentQuality(4)', context), true)
    actual.value = 'higher'
    assert.equal(vm.runInContext('currentQualityText.value', context), '较高')
    assert.equal(vm.runInContext('isCurrentQuality(4)', context), true)
    actual.value = undefined
    assert.equal(vm.runInContext('currentQualityText.value', context), 'HQ极高')
    assert.equal(vm.runInContext('getQuality("netease")', context), 4)
    currentSong.value.musicUrl = 'https://audio.example/new.mp3'
    assert.equal(vm.runInContext('currentQualityText.value', context), '标准')
    assert.equal(vm.runInContext('isCurrentQuality(2)', context), true)
  }
})
