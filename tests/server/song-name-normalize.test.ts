import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeForMatch, toSimplifiedChinese } from '../../app/utils/song-name-normalize.ts'

test('繁体标题与简体库存归一化后相等', () => {
  assert.equal(normalizeForMatch('海闊天空'), normalizeForMatch('海阔天空'))
})

test('繁体歌手名归一化后相等', () => {
  assert.equal(normalizeForMatch('周杰倫'), normalizeForMatch('周杰伦'))
  assert.equal(normalizeForMatch('陳奕迅'), normalizeForMatch('陈奕迅'))
})

test('归一化移除 feat./ft. 词条与空白标点', () => {
  // 口径沿用现网版本：仅移除 feat/ft 词条本体，其后标点由标点规则处理
  assert.equal(normalizeForMatch('一首歌 ft. 某人'), '一首歌.某人')
  assert.equal(
    normalizeForMatch('晴天 (feat. 周杰伦)'),
    normalizeForMatch('晴天.周杰伦')
  )
  assert.equal(normalizeForMatch('《红玫瑰》'), normalizeForMatch('红玫瑰'))
})

test('&/＆ 统一为 and', () => {
  assert.equal(normalizeForMatch('A&B'), normalizeForMatch('A＆B'))
  assert.equal(normalizeForMatch('A&B'), 'aandb')
})

test('弯引号被视为可去除标点', () => {
  assert.equal(normalizeForMatch('“回忆”'), normalizeForMatch('回忆'))
})

test('大小写不敏感', () => {
  assert.equal(normalizeForMatch('LOVE Story'), normalizeForMatch('love story'))
})

test('回归: 含 feat 字母的普通英文单词不被误删', () => {
  // 旧实现使用字符类 [feat\.?|ft\.?] 会删掉所有 f/e/a/t 字母
  assert.equal(toSimplifiedChinese(normalizeForMatch('Coffee')), 'coffee')
  assert.equal(toSimplifiedChinese(normalizeForMatch('Eason Chan')), 'easonchan')
})

test('空值与原样返回', () => {
  assert.equal(normalizeForMatch(''), '')
  assert.equal(toSimplifiedChinese(''), '')
})
