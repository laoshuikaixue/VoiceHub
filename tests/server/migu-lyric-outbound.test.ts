import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { networkUrl } from '../../server/utils/music-source-plugins/network.ts'

// 咪咕歌词出站请求守卫：歌词地址不得由调用方传入，出站一律走安全网络层
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')
const MG_LYRIC = read('../../server/api/native-api/lyric/mg.get.ts')

test('歌词路由不透传调用方 URL，出站走 requestNetwork', () => {
  assert.doesNotMatch(MG_LYRIC, /query\.(lrcUrl|mrcUrl)/, '不得再从 query 读取歌词 URL')
  assert.doesNotMatch(MG_LYRIC, /await fetch\(/, '出站不得使用裸 fetch')
  assert.match(MG_LYRIC, /requestNetwork\(/, '出站应复用安全网络层')
  assert.match(MG_LYRIC, /LYRIC_MAX_BYTES/, '响应正文须有大小上限')
  assert.match(MG_LYRIC, /encodeURIComponent\(contentId\)/, 'contentId 进入上游查询串前须编码')
})

test('networkUrl：拒绝回环、私网与云元数据地址', () => {
  for (const blocked of [
    'http://127.0.0.1:8080/private',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.100.100.200/latest/meta-data/',
    'http://10.0.0.1/x',
    'http://192.168.1.1/x',
    'http://[::1]/x',
    'http://localhost:3000/api/admin/system-settings'
  ]) {
    assert.throws(() => networkUrl(blocked), `应拒绝内网目标：${blocked}`)
  }
})

test('networkUrl：拒绝非 http(s) 协议与 URL 内嵌凭据', () => {
  assert.throws(() => networkUrl('file:///etc/passwd'))
  assert.throws(() => networkUrl('ftp://example.com/lyric'))
  assert.throws(() => networkUrl('http://user:pass@8.8.8.8/x'))
  assert.throws(() => networkUrl('not-a-url'))
})

test('networkUrl：放行公网音源域名', () => {
  for (const allowed of [
    'https://app.c.nf.migu.cn/resource/song/by-contentids/v2.0?contentId=abc',
    'https://muc.migu.cn/lyric/x.lrc',
    'https://music.163.com/x'
  ]) {
    assert.equal(networkUrl(allowed).protocol, 'https:')
  }
})
