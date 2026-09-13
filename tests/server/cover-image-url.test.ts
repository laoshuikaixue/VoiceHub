import test from 'node:test'
import assert from 'node:assert/strict'
import { getSizedCoverUrl } from '../../app/utils/url.ts'

const QQ_MID = '000Fby4A0T9Vgt'

test('网易云封面追加尺寸参数', () => {
  assert.equal(
    getSizedCoverUrl('https://p2.music.126.net/Ntz9UmLeC4cd6gTP82aaZA==/109951173874154106.jpg'),
    'https://p2.music.126.net/Ntz9UmLeC4cd6gTP82aaZA==/109951173874154106.jpg?param=300y300'
  )
})

test('网易云保留 HTTP 协议与路径中的等号', () => {
  assert.equal(
    getSizedCoverUrl('http://p1.music.126.net/abc==/1.jpg'),
    'http://p1.music.126.net/abc==/1.jpg?param=300y300'
  )
})

test('网易云支持自定义边长', () => {
  assert.equal(
    getSizedCoverUrl('https://p1.music.126.net/abc==/1.jpg', 500),
    'https://p1.music.126.net/abc==/1.jpg?param=500y500'
  )
})

test('网易云已带尺寸参数时不重复追加', () => {
  const url = 'https://p2.music.126.net/abc==/1.jpg?param=500y500'
  assert.equal(getSizedCoverUrl(url), url)
})

test('QQ音乐封面按路径尺寸段收敛', () => {
  assert.equal(
    getSizedCoverUrl(`https://y.gtimg.cn/music/photo_new/T002R500x500M000${QQ_MID}.jpg`),
    `https://y.gtimg.cn/music/photo_new/T002R300x300M000${QQ_MID}.jpg`
  )
  assert.equal(
    getSizedCoverUrl(`https://y.gtimg.cn/music/photo_new/T002R800x800M000${QQ_MID}.jpg`),
    `https://y.gtimg.cn/music/photo_new/T002R300x300M000${QQ_MID}.jpg`
  )
  assert.equal(
    getSizedCoverUrl(`https://y.qq.com/music/photo_new/T001R500x500M000${QQ_MID}.jpg`),
    `https://y.qq.com/music/photo_new/T001R300x300M000${QQ_MID}.jpg`
  )
})

test('QQ音乐已足够小则保持原样（只收敛不放大）', () => {
  for (const path of [
    `T002R300x300M000${QQ_MID}.jpg`,
    `T002R150x150M000${QQ_MID}.jpg`,
    `T001R200x200M000${QQ_MID}.jpg`
  ]) {
    const url = `https://y.gtimg.cn/music/photo_new/${path}`
    assert.equal(getSizedCoverUrl(url), url)
  }
})

test('QQ音乐支持自定义边长', () => {
  assert.equal(
    getSizedCoverUrl(`https://y.gtimg.cn/music/photo_new/T002R500x500M000${QQ_MID}.jpg`, 500),
    `https://y.gtimg.cn/music/photo_new/T002R500x500M000${QQ_MID}.jpg`
  )
  assert.equal(
    getSizedCoverUrl(`https://y.gtimg.cn/music/photo_new/T002R500x500M000${QQ_MID}.jpg`, 200),
    `https://y.gtimg.cn/music/photo_new/T002R200x200M000${QQ_MID}.jpg`
  )
})

test('QQ音乐无尺寸段的路径保持原样', () => {
  for (const url of [
    'https://y.gtimg.cn/music/emoji/example.png',
    'https://y.gtimg.cn/music/photo_new/T002M000abc.jpg'
  ]) {
    assert.equal(getSizedCoverUrl(url), url)
  }
})

test('QQ音乐尺寸段不限定路径前缀', () => {
  assert.equal(
    getSizedCoverUrl(`https://y.gtimg.cn/other/T002R500x500M000${QQ_MID}.jpg`),
    `https://y.gtimg.cn/other/T002R300x300M000${QQ_MID}.jpg`
  )
})

test('不支持尺寸控制的来源原样返回', () => {
  const urls = [
    'https://d.musicapp.migu.cn/data/oss/resource/00/5u/7q/02c701729f0142b8b8938d8cf11eaf22.webp',
    'https://i0.hdslb.com/bfs/archive/1.jpg',
    'https://y.gtimg.cn.evil.com/music/photo_new/T002R500x500M000x.jpg'
  ]
  for (const url of urls) {
    assert.equal(getSizedCoverUrl(url), url)
  }
})

test('空值与非法 URL 不抛错', () => {
  assert.equal(getSizedCoverUrl(''), '')
  assert.equal(getSizedCoverUrl(null), '')
  assert.equal(getSizedCoverUrl(undefined), '')
  assert.equal(getSizedCoverUrl('not a url'), 'not a url')
})

test('裸域名与子域名均命中', () => {
  assert.equal(
    getSizedCoverUrl('https://music.126.net/1.jpg'),
    'https://music.126.net/1.jpg?param=300y300'
  )
  assert.equal(
    getSizedCoverUrl('https://p9.music.126.net/1.jpg'),
    'https://p9.music.126.net/1.jpg?param=300y300'
  )
})
