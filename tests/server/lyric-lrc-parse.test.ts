import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLrc } from '../../app/utils/lyric/parseLrc.ts'

// 复刻网易云 1427767861 歌词的时间戳结构（歌词正文用占位符替代，避免歌词入库）：
// 元数据样行带时间戳，毫秒位混合 1/2/3 位小数，另含两行纯时间戳间奏行。
// 旧正则要求毫秒位 2-3 位小数，会把 1 位小数的正文行整行丢弃。
const NETEASE_MIXED_PRECISION_LRC = [
  '[00:00.00] 作词 : 占位',
  '[00:01.00] 作曲 : 占位',
  '[00:34.55]样行01',
  '[00:35.55]样行02',
  '[00:36.55]样行03',
  '[00:46.25]正文01',
  '[00:53.50]正文02',
  '[01:00.7]正文03',
  '[01:08.49]正文04',
  '[01:15.47]正文05',
  '[01:19.13]正文06',
  '[01:22.86]正文07',
  '[01:26.36]正文08',
  '[01:30.24]正文09',
  '[01:33.89]正文10',
  '[01:37.40]正文11',
  '[01:41.00]正文12',
  '[01:45.9]',
  '[01:46.68]正文13',
  '[01:54.0]正文14',
  '[02:01.2]正文15',
  '[02:08.59]正文16',
  '[02:16.0]正文17',
  '[02:19.63]正文18',
  '[02:23.36]正文19',
  '[02:27.0]正文20',
  '[02:30.80]正文21',
  '[02:34.29]正文22',
  '[02:38.0]正文23',
  '[02:41.61]正文24',
  '[02:45.52]',
  '[03:20.00]正文25',
  '[03:27.6]正文26',
  '[03:35.29]正文27',
  '[03:38.82]正文28',
  '[03:42.61]正文29',
  '[03:46.14]正文30',
  '[03:49.87]正文31',
  '[03:53.46]正文32',
  '[03:57.23]正文33',
  '[04:00.84]正文34',
  '[04:04.49]正文35',
  '[04:08.1]正文36',
  '[04:11.74]正文37',
  '[04:15.24]正文38',
  '[04:19.19]正文39',
  '[04:22.86]正文40',
  '[04:26.46]正文41',
  '[04:29.93]正文42',
  '[04:33.81]正文43'
].join('\n')

test('混合毫秒精度的 lrc 正文行全部保留', () => {
  const lines = parseLrc(NETEASE_MIXED_PRECISION_LRC)
  // 50 行 = 48 行带正文（含 5 行元数据样行）+ 2 行纯时间戳间奏行（按设计跳过）
  assert.equal(lines.length, 48)
})

test('1 位毫秒小数按十进制补齐 3 位', () => {
  const lines = parseLrc(NETEASE_MIXED_PRECISION_LRC)
  // [01:00.7] -> 700ms；[02:16.0] -> 0ms
  const line60 = lines.find((l) => l.startTime === 60700)
  const line136 = lines.find((l) => l.startTime === 136000)
  assert.ok(line60, '[01:00.7] 正文行未被解析')
  assert.equal(line60.words[0].word, '正文03')
  assert.ok(line136, '[02:16.0] 正文行未被解析')
  assert.equal(line136.words[0].word, '正文17')
})

test('2/3 位毫秒小数解析不受影响', () => {
  const lines = parseLrc(NETEASE_MIXED_PRECISION_LRC)
  assert.ok(lines.find((l) => l.startTime === 46250), '[00:46.25] 解析错误')
  assert.ok(lines.find((l) => l.startTime === 200000), '[03:20.00] 解析错误')
})

test('3 位毫秒小数原样解析', () => {
  const lines = parseLrc('[00:46.123]三位小数行')
  assert.equal(lines.length, 1)
  assert.equal(lines[0].startTime, 46123)
  assert.equal(lines[0].words[0].word, '三位小数行')
})

test('无小数毫秒的时间戳可解析', () => {
  const lines = parseLrc('[00:46]无小数行\n[01:02]下一行')
  assert.equal(lines.length, 2)
  assert.equal(lines[0].startTime, 46000)
  assert.equal(lines[0].words[0].word, '无小数行')
  assert.equal(lines[1].startTime, 62000)
})

test('纯时间戳间奏行仍然跳过', () => {
  const lines = parseLrc(NETEASE_MIXED_PRECISION_LRC)
  // [01:45.9] 与 [02:45.52] 为空正文间奏行
  assert.ok(!lines.find((l) => l.startTime === 105900))
  assert.ok(!lines.find((l) => l.startTime === 165520))
})

test('输出按时间升序且时间标签从正文剔除', () => {
  const lines = parseLrc(NETEASE_MIXED_PRECISION_LRC)
  for (let i = 1; i < lines.length; i++) {
    assert.ok(lines[i].startTime >= lines[i - 1].startTime)
  }
  const first = lines[0]
  assert.equal(first.words[0].word, '作词 : 占位')
})

test('空内容返回空数组', () => {
  assert.deepEqual(parseLrc(''), [])
})
