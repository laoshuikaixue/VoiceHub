import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detectSharePlatform,
  extractBilibiliBvid,
  extractNeteaseSongId,
  extractShareUrl,
  extractTencentSongId,
  isShortLink
} from '../../server/utils/astrbot-share-link.ts'

test('网易云分享文本：域名识别 + song?id 提取', () => {
  const text = '分享周杰伦的单曲《晴天》 https://music.163.com/song?id=186016&userid=1 快来听听'
  assert.equal(detectSharePlatform(text), 'netease')
  assert.equal(extractShareUrl(text), 'https://music.163.com/song?id=186016&userid=1')
  assert.equal(extractNeteaseSongId('https://music.163.com/song?id=186016&userid=1'), '186016')
})

test('网易云路径形式 /song/<id> 也能提取', () => {
  assert.equal(extractNeteaseSongId('https://music.163.com/song/186016/'), '186016')
})

test('163cn.tv 短链识别为网易云且标记需跳转', () => {
  const text = 'http://163cn.tv/abcdef （分享自网易云音乐）'
  assert.equal(detectSharePlatform(text), 'netease')
  assert.ok(isShortLink('http://163cn.tv/abcdef'))
})

test('QQ 音乐链接：y.qq.com + songDetail/<mid>', () => {
  const text = '《晴天》 https://y.qq.com/n/ryqq/songDetail/001J5QJL1pLQRE'
  assert.equal(detectSharePlatform(text), 'tencent')
  assert.equal(extractTencentSongId('https://y.qq.com/n/ryqq/songDetail/001J5QJL1pLQRE'), '001J5QJL1pLQRE')
})

test('QQ 音乐 songid 查询参数', () => {
  assert.equal(extractTencentSongId('https://i.y.qq.com/n2/m/share/details/taoge.html?songid=4830342'), '4830342')
})

test('B站链接：bilibili.com/video/BV 号', () => {
  const text = '【MV】晴天 https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333'
  assert.equal(detectSharePlatform(text), 'bilibili')
  assert.equal(extractBilibiliBvid('https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333'), 'BV1xx411c7mD')
})

test('b23.tv 短链识别为B站且标记需跳转', () => {
  const text = 'https://b23.tv/abc123 我在B站发现了这个'
  assert.equal(detectSharePlatform(text), 'bilibili')
  assert.ok(isShortLink('https://b23.tv/abc123'))
  // 短链本身没有 BV 号
  assert.equal(extractBilibiliBvid('https://b23.tv/abc123'), null)
})

test('普通文本与未知域名返回 null', () => {
  assert.equal(detectSharePlatform('告白气球'), null)
  assert.equal(detectSharePlatform('https://example.com/song?id=1'), null)
  assert.equal(extractShareUrl('没有链接的文本'), null)
  assert.equal(detectSharePlatform(''), null)
  assert.equal(detectSharePlatform(null), null)
})

test('分享文本含干扰字符时 URL 提取在中文标点处截断', () => {
  const text = 'https://music.163.com/song?id=186016，很好听'
  assert.equal(extractShareUrl(text), 'https://music.163.com/song?id=186016')
})
