import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAYER_LAYOUT_MARGIN,
  PLAYER_LAYOUT_MARGIN_MOBILE,
  PLAYER_LAYOUT_STORAGE_KEY,
  clampPlayerPosition,
  parsePlayerLayout,
  parsePlayerLayoutMode,
  serializePlayerLayout
} from '../../app/utils/playerLayout.ts'

const SIZE = { width: 400, height: 165 }
const VIEWPORT = { width: 1280, height: 800 }

test('存储键固定，避免改动后丢失用户偏好', () => {
  assert.equal(PLAYER_LAYOUT_STORAGE_KEY, 'voicehub-player-layout')
})

test('限位间距与播放器 CSS 取值一致', () => {
  assert.equal(PLAYER_LAYOUT_MARGIN, 16)
  assert.equal(PLAYER_LAYOUT_MARGIN_MOBILE, 10)
})

test('布局模式只认 floating，其余一律固定模式', () => {
  assert.equal(parsePlayerLayoutMode('floating'), 'floating')
  assert.equal(parsePlayerLayoutMode('docked'), 'docked')
  assert.equal(parsePlayerLayoutMode('free'), 'docked')
  assert.equal(parsePlayerLayoutMode(undefined), 'docked')
  assert.equal(parsePlayerLayoutMode(null), 'docked')
  assert.equal(parsePlayerLayoutMode(1), 'docked')
})

test('坐标落在视口内时保持原值', () => {
  assert.deepEqual(clampPlayerPosition({ x: 300, y: 200 }, SIZE, VIEWPORT), { x: 300, y: 200 })
})

test('越界坐标回收到安全间距内', () => {
  assert.deepEqual(clampPlayerPosition({ x: -50, y: -80 }, SIZE, VIEWPORT), {
    x: PLAYER_LAYOUT_MARGIN,
    y: PLAYER_LAYOUT_MARGIN
  })
  assert.deepEqual(clampPlayerPosition({ x: 5000, y: 5000 }, SIZE, VIEWPORT), {
    x: VIEWPORT.width - SIZE.width - PLAYER_LAYOUT_MARGIN,
    y: VIEWPORT.height - SIZE.height - PLAYER_LAYOUT_MARGIN
  })
})

test('支持自定义间距（移动端播放条左右各 10px）', () => {
  const margin = PLAYER_LAYOUT_MARGIN_MOBILE
  const mobileSize = { width: 340, height: 64 }
  const mobileViewport = { width: 360, height: 780 }
  assert.deepEqual(clampPlayerPosition({ x: 10, y: 300 }, mobileSize, mobileViewport, margin), {
    x: 10,
    y: 300
  })
  assert.deepEqual(clampPlayerPosition({ x: 999, y: 999 }, mobileSize, mobileViewport, margin), {
    x: margin,
    y: 780 - 64 - margin
  })
  // 播放条铺满可视宽度，横向被钉在贴边位置
  assert.deepEqual(clampPlayerPosition({ x: 120, y: 300 }, mobileSize, mobileViewport, margin), {
    x: margin,
    y: 300
  })
})

test('视口比播放器还小时贴边显示，不产生负坐标', () => {
  assert.deepEqual(clampPlayerPosition({ x: 100, y: 100 }, SIZE, { width: 320, height: 120 }), {
    x: 0,
    y: 0
  })
})

test('非有限坐标回退到最小间距', () => {
  assert.deepEqual(clampPlayerPosition({ x: Number.NaN, y: Infinity }, SIZE, VIEWPORT), {
    x: PLAYER_LAYOUT_MARGIN,
    y: PLAYER_LAYOUT_MARGIN
  })
  assert.deepEqual(clampPlayerPosition(null, SIZE, VIEWPORT), {
    x: PLAYER_LAYOUT_MARGIN,
    y: PLAYER_LAYOUT_MARGIN
  })
})

test('解析本地存储：非法 JSON 回退默认值', () => {
  assert.deepEqual(parsePlayerLayout('{ 不是 JSON'), { mode: 'docked', position: null })
  assert.deepEqual(parsePlayerLayout(''), { mode: 'docked', position: null })
  assert.deepEqual(parsePlayerLayout(null), { mode: 'docked', position: null })
})

test('解析本地存储：非对象与数组回退默认值', () => {
  assert.deepEqual(parsePlayerLayout('123'), { mode: 'docked', position: null })
  assert.deepEqual(parsePlayerLayout('"floating"'), { mode: 'docked', position: null })
  assert.deepEqual(parsePlayerLayout('[1,2]'), { mode: 'docked', position: null })
})

test('解析本地存储：未知模式与非法坐标分别回退', () => {
  assert.deepEqual(parsePlayerLayout('{"mode":"fullscreen","position":{"x":10,"y":20}}'), {
    mode: 'docked',
    position: { x: 10, y: 20 }
  })
  assert.deepEqual(parsePlayerLayout('{"mode":"floating","position":{"x":"10","y":20}}'), {
    mode: 'floating',
    position: null
  })
  assert.deepEqual(parsePlayerLayout('{"mode":"floating","position":null}'), {
    mode: 'floating',
    position: null
  })
})

test('解析本地存储：完整状态可原样读回', () => {
  assert.deepEqual(parsePlayerLayout('{"mode":"floating","position":{"x":12.5,"y":40}}'), {
    mode: 'floating',
    position: { x: 12.5, y: 40 }
  })
})

test('序列化后取整，并可被解析回同一模式', () => {
  const raw = serializePlayerLayout({ mode: 'floating', position: { x: 12.4, y: 40.6 } })
  assert.deepEqual(parsePlayerLayout(raw), { mode: 'floating', position: { x: 12, y: 41 } })
})

test('序列化遇到非法值降级为固定模式', () => {
  const raw = serializePlayerLayout({ mode: 'free' as never, position: { x: Number.NaN, y: 1 } })
  assert.deepEqual(parsePlayerLayout(raw), { mode: 'docked', position: null })
})
