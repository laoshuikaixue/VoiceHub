import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCloudLibrary, matchCloudFiles, normalizeCloudFile, validateCloudDownload } from '../../app/utils/neteaseCloud.ts'
import { createPlaybackRequest, withPlaybackSignal } from '../../app/utils/playbackRequest.ts'
import { resolveNeteaseCatalogUrl } from '../../app/utils/neteaseCatalog.ts'

const record = (songId = 200001, md5 = 'abcdef') => ({
  songId, fileName: '测试版本.flac', fileSize: 4000, bitrate: 1411000,
  simpleSong: { id: 10001, pc: { id: songId, originalAudioSongId: songId, songId: 10001, md5 } }
})

test('公开音质：登录态返回云盘文件时以公开会话重试，保留所选标准音质', async () => {
  const requests: any[] = []
  const file = normalizeCloudFile(record())!
  const result = await resolveNeteaseCatalogUrl({baseUrl:'/netease',id:'10001',level:'standard',cookie:'测试登录态',cloudFiles:[file],
    fetcher:async (url, options) => {
      requests.push({url,params:options.params})
      return {code:200,data:[options.params.cookie === '测试登录态'
        ? {url:'https://cloud.example/file',level:'hires',size:4000,type:'flac',md5:'abcdef'}
        : {url:'https://catalog.example/standard.mp3',level:'standard',br:128000}]}
    }})
  assert.equal(result.actualQuality, 'standard')
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request=>request.params.level==='standard'&&request.params.unblock===false))
  assert.equal(requests[1].params.cookie, 'MUSIC_U=;')
})

test('公开音质：即使音质标签相同，也不能把云盘原文件当作公开 Hi-Res', async () => {
  let calls = 0
  const file = normalizeCloudFile(record())!
  const result = await resolveNeteaseCatalogUrl({baseUrl:'/netease',id:'10001',level:'hires',cookie:'测试登录态',cloudFiles:[file],
    fetcher:async (_, options) => {
      calls++
      const loggedIn = options.params.cookie === '测试登录态'
      return {code:200,data:[{url:loggedIn?'https://cloud.example/file':'https://catalog.example/hires.flac',level:'hires',size:loggedIn?4000:8000,type:'flac',md5:loggedIn?'abcdef':'公开文件哈希'}]}
    }})
  assert.equal(calls, 2)
  assert.equal(result.url, 'https://catalog.example/hires.flac')
})

test('公开音质：所选音质不可用时拒绝降级和伪报成功', async () => {
  const levels: string[] = []
  await assert.rejects(resolveNeteaseCatalogUrl({baseUrl:'/netease',id:'10001',level:'lossless',cookie:'测试登录态',
    fetcher:async (_, options) => {
      levels.push(options.params.level)
      return {code:200,data:[{url:'https://catalog.example/other',level:options.params.cookie === '测试登录态'?'hires':'exhigh'}]}
    }}), (error:any)=>error.data.code==='MUSIC_CATALOG_QUALITY_UNAVAILABLE')
  assert.deepEqual(levels, ['lossless','lossless'])
})

test('公开音质：正常会员曲库结果保留登录态，不强制使用公开会话', async () => {
  let calls = 0
  const result = await resolveNeteaseCatalogUrl({baseUrl:'/netease',id:'10001',level:'lossless',cookie:'测试登录态',
    fetcher:async (_, options) => {
      calls++
      assert.equal(options.params.cookie, '测试登录态')
      return {code:200,data:[{url:'https://catalog.example/lossless.flac',level:'lossless'}]}
    }})
  assert.equal(calls, 1)
  assert.equal(result.actualQuality, 'lossless')
})

test('公开音质：取消后不再启动公开会话重试', async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(resolveNeteaseCatalogUrl({baseUrl:'/netease',id:'10001',level:'standard',cookie:'测试登录态',signal:controller.signal,
    fetcher:async () => {calls++;controller.abort();throw controller.signal.reason}}),{name:'AbortError'})
  assert.equal(calls, 1)
})

test('公开音质：上游返回其他歌曲的链接时拒绝采用', async () => {
  await assert.rejects(resolveNeteaseCatalogUrl({baseUrl:'/netease',id:'10001',level:'standard',
    fetcher:async () => ({code:200,data:[{id:10002,url:'https://catalog.example/wrong.mp3',level:'standard'}]})
  }), (error:any)=>error.data.code==='MUSIC_CATALOG_QUALITY_UNAVAILABLE')
})

test('云盘下载 ID 与曲库关联 ID 分离，匹配不依赖歌名', () => {
  const file = normalizeCloudFile(record())!
  assert.equal(file.downloadId, '200001')
  assert.equal(file.format, 'FLAC')
  assert.deepEqual(matchCloudFiles([file], 10001), [file])
  assert.deepEqual(matchCloudFiles([file], 10002, { title: '测试版本' }), [])
  assert.equal(normalizeCloudFile({ simpleSong: { id: 10001 } }), null)
})

test('多文件保留全部版本，显式云盘身份精确选中文件', () => {
  const files = [normalizeCloudFile(record())!, normalizeCloudFile(record(200002, 'bbbbbb'))!]
  assert.equal(matchCloudFiles(files, 10001).length, 2)
  assert.deepEqual(matchCloudFiles(files, 10001, { pc: { id: 200002 } }), [files[1]])
})

test('云盘空链接、错误响应、文件 MD5 或大小不符均禁止播放', () => {
  const file = normalizeCloudFile(record())!
  assert.equal(validateCloudDownload({ code: 200, url: 'https://music.example/original.flac', size: 4000, name: '测试版本.flac' }, file), 'https://music.example/original.flac')
  assert.equal(validateCloudDownload({ code: 200, data: { url: 'http://music.example/file', md5: 'ABCDEF', size: 4000 } }, file), 'https://music.example/file')
  for (const response of [
    { code: 200, data: { url: null } },
    { code: 301, data: { url: 'https://music.example/file' } },
    { code: 200, data: { url: 'https://music.example/file', md5: 'wrong' } },
    { code: 200, data: { url: 'https://music.example/file', size: 4001 } }
  ]) assert.throws(() => validateCloudDownload(response, file))
  assert.throws(() => validateCloudDownload({ code: 200, url: 'https://music.example/file', size: 4000, name: '错误版本.wav' }, file))
  assert.throws(() => validateCloudDownload({ code: 200, url: 'https://music.example/file', size: 4000, type: 'mp3' }, file))
})

test('云盘分页完整加载、并发合并并按五分钟过期', async () => {
  let now = 0
  const offsets: number[] = []
  const library = createCloudLibrary(async offset => {
    offsets.push(offset)
    return { code: 200, data: [record(offset ? 200002 : 200001)], count: 2, hasMore: !offset }
  }, () => now)
  const [a, b] = await Promise.all([library.load('账号A'), library.load('账号A')])
  assert.equal(a.length, 2)
  assert.equal(a, b)
  assert.deepEqual(offsets, [0, 1])
  await library.load('账号A')
  assert.equal(offsets.length, 2)
  now = 300001
  await library.load('账号A')
  assert.equal(offsets.length, 4)
})

test('失败或异常分页不作为未命中缓存，下一次仍重新查询', async () => {
  let calls = 0
  const library = createCloudLibrary(async () => {
    if (++calls === 1) return { code: 301 }
    if (calls === 2) return { code: 200, data: [], hasMore: true }
    return { code: 200, data: [], count: 0 }
  }, () => 0)
  await assert.rejects(library.load('A'))
  await assert.rejects(library.load('A'))
  assert.deepEqual(await library.load('A'), [])
  assert.equal(calls, 3)
})

test('切换账号与上传失效后，旧异步结果不能污染新索引', async () => {
  let finish: (value: any) => void = () => {}
  let bCalls = 0
  const library = createCloudLibrary(async (_, session) => {
    if (session === 'A') return new Promise(resolve => { finish = resolve })
    bCalls++
    return { code: 200, data: [record(200002)] }
  }, () => 0)
  const old = library.load('A')
  const current = await library.load('B')
  finish({ code: 200, data: [record(200001)] })
  await old
  assert.equal((await library.load('B'))[0].key, current[0].key)
  assert.equal(bCalls, 1)
  library.reset()
  await library.load('B')
  assert.equal(bCalls, 2)
})

test('播放取消立即终止等待，迟到的解析结果不被采用', async () => {
  const request = createPlaybackRequest(1000)
  let finish: (value: string) => void = () => {}
  const pending = withPlaybackSignal(new Promise<string>(resolve => { finish = resolve }), request.signal)
  request.cancel()
  await assert.rejects(pending, { name: 'AbortError' })
  finish('过期歌曲')
})

test('等待用户选择暂停解析截止时间，恢复后按剩余预算超时', async () => {
  const request = createPlaybackRequest(30)
  request.pause()
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(request.signal.aborted, false)
  const pending = withPlaybackSignal(new Promise(() => {}), request.signal)
  request.resume()
  await assert.rejects(pending, { name: 'TimeoutError' })
  request.dispose()
})
