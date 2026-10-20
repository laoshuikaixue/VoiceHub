import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'
import { computed, readonly, ref } from 'vue'
import { getNeteaseCatalogUrl } from '../../app/utils/neteaseCatalog.ts'

const track = (overrides: Record<string, unknown> = {}) => ({
  id: 10001, level: 'exhigh', url: 'https://audio.example/full.mp3', freeTrialInfo: null, ...overrides
})
const response = (overrides: Record<string, unknown> = {}) => ({ code: 200, data: [track(overrides)] })

test('完整曲库响应保留 URL，兼容字符串 ID 和缺省试听标记', () => {
  assert.equal(getNeteaseCatalogUrl(response(), 'exhigh', '10001'), track().url)
  assert.equal(getNeteaseCatalogUrl(response({ id: '10001', freeTrialInfo: undefined }), 'exhigh', 10001), track().url)
})

test('批量响应按首个请求 ID 取对应歌曲，不依赖返回顺序', () => {
  assert.equal(getNeteaseCatalogUrl({ code: 200, data: [track({ id: 10002, url: 'https://audio.example/other' }), track()] }, 'exhigh', '10001,10002'), track().url)
})

for (const level of ['standard', 'lossless', 'hires', undefined]) {
  test(`实际音质 ${String(level)} 不匹配所选 HQ 时拒绝`, () => {
    assert.equal(getNeteaseCatalogUrl(response({ level }), 'exhigh', 10001), null)
  })
}

for (const freeTrialInfo of [{ start: 0, end: 30 }, {}, 'null', false]) {
  test(`试听或异常试听标记 ${JSON.stringify(freeTrialInfo)} 不作为完整播放响应`, () => {
    assert.equal(getNeteaseCatalogUrl(response({ freeTrialInfo }), 'exhigh', 10001), null)
  })
}

test('曲库未返回目标歌曲时拒绝其他歌曲及缺省 ID', () => {
  assert.equal(getNeteaseCatalogUrl(response({ id: 10002 }), 'exhigh', 10001), null)
  assert.equal(getNeteaseCatalogUrl(response({ id: undefined }), 'exhigh', 10001), null)
})

test('失败及畸形响应不抛错、不返回 URL', () => {
  for (const value of [null, [], {}, { code: 403, data: [track()] }, { code: 200, data: null }, { code: 200, data: [null] }]) {
    assert.equal(getNeteaseCatalogUrl(value, 'exhigh', 10001), null)
  }
})

test('拒绝空链接、无效 URL 和非 HTTP 协议，保留既有 HTTP 升级路径', () => {
  for (const url of ['', null, 123, 'not-a-url', 'javascript:alert(1)', 'file:///audio.mp3']) {
    assert.equal(getNeteaseCatalogUrl(response({ url }), 'exhigh', 10001), null)
  }
  assert.equal(getNeteaseCatalogUrl(response({ url: 'http://audio.example/full.mp3' }), 'exhigh', 10001), 'http://audio.example/full.mp3')
})

const root = path.resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
type Request = { url: string; params?: Record<string, unknown> }
type Resolver = { getSongUrl: (id: string, quality: number, platform: string, cookie?: string, options?: { excludeSources?: string[] }) => Promise<{ success: boolean; url?: string; source?: string }> }

async function sourceHarness(fetcher: (request: Request) => unknown): Promise<Resolver> {
  const mocks: Record<string, string> = {
    '~/utils/musicSources': 'const sources=[{id:"netease-backup-1",baseUrl:"/netease"},{id:"netease-gdstudio",baseUrl:"/gd"},{id:"vkeys",baseUrl:"/qq"},{id:"bilibili",baseUrl:"/bili"}]; export const MUSIC_SOURCE_CONFIG={primarySource:sources[0].id};export const getEnabledSources=()=>sources;export const getSourceById=id=>sources.find(x=>x.id===id);export const getVkeysIdParam=(platform,id)=>({key:"id",value:id})',
    '~/utils/bilibiliSource': 'export const getBilibiliTrackUrl=async()=>({url:"https://bili.example/audio"});export const searchBilibili=()=>{};export const parseBilibiliId=id=>({bvid:id})',
    '~/utils/lyric/lyricMatchQuality': 'export const evaluateLyricDataMatch=()=>{}',
    '~/utils/invalidPlaybackUrls': 'export const isPlaybackUrlInvalid=()=>false',
    './useLyricSettings': 'export const useLyricSettings=()=>({})',
    './usePlatformConfig': 'export const usePlatformConfig=()=>({enabledPlatforms:{value:["netease","tencent","bilibili"]}})',
    './useLocaleText': 'export const useServerErrors=()=>({localize:()=>"错误"})',
    '~/utils/locale': 'export const useLocale=()=>({audioPlayer:{value:{}}})',
    '~/utils/platforms': 'export const getPlatformDisplayName=()=>"网易云"',
    '~/utils/pluginPlatform': 'export const getPluginId=()=>{};export const getPluginQuality=x=>x;export const isPluginPlatform=()=>false',
    './useAudioQuality': 'export const useAudioQuality=()=>({getQuality:()=>4})'
  }
  const bundle = await build({
    entryPoints: [path.join(root, 'app/composables/useMusicSources.ts')], bundle: true, write: false,
    platform: 'node', format: 'cjs', define: { 'import.meta.client': 'false' },
    plugins: [{ name: '曲库依赖替身', setup(builder) {
      builder.onResolve({ filter: /^(~\/|\.\/)/ }, args => mocks[args.path]
        ? { path: args.path, namespace: 'mock' }
        : args.path.startsWith('~/') ? { path: path.join(root, 'app', args.path.slice(2)) + '.ts' } : null)
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }))
    } }]
  })
  const module = { exports: {} as { useMusicSources: () => Resolver } }
  const context = vm.createContext({ module, exports: module.exports, require, ref, computed, readonly, URL, console,
    $fetch: (url: string, options: { params?: Record<string, unknown> }) => fetcher({ url, params: options?.params }) })
  new vm.Script(bundle.outputFiles[0].text).runInContext(context)
  return module.exports.useMusicSources()
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

test('真实取链分支拒绝虚标音质和试听片段，继续原有备用音源', async () => {
  for (const bad of [response({ level: 'hires' }), response({ freeTrialInfo: { start: 0, end: 30 } })]) {
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
