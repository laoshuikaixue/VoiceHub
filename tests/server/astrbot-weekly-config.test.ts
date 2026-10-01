import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ASTRBOT_WEEKLY_BOOLEAN_KEYS,
  ASTRBOT_WEEKLY_LAYOUTS,
  DEFAULT_ASTRBOT_WEEKLY_CONFIG,
  normalizeAstrbotWeeklyConfig
} from '../../server/utils/astrbot-weekly-config.ts'

test('归一化保留持久化的排版样式与列数（不得被布尔判定回退成默认）', () => {
  const result = normalizeAstrbotWeeklyConfig({ layoutStyle: 'table', listColumns: 2, showLogo: false })
  assert.equal(result.layoutStyle, 'table')
  assert.equal(result.listColumns, 2)
  assert.equal(result.showLogo, false)
  // 未下发的布尔项回退默认
  assert.equal(result.showVotes, DEFAULT_ASTRBOT_WEEKLY_CONFIG.showVotes)
  assert.equal(result.showArtist, true)
})

test('归一化对脏数据回退默认：未知排版样式与越界列数', () => {
  const result = normalizeAstrbotWeeklyConfig({ layoutStyle: 'nope', listColumns: 9 })
  assert.equal(result.layoutStyle, DEFAULT_ASTRBOT_WEEKLY_CONFIG.layoutStyle)
  assert.equal(result.listColumns, DEFAULT_ASTRBOT_WEEKLY_CONFIG.listColumns)
})

test('归一化对空值/非对象输入返回完整默认配置', () => {
  for (const input of [null, undefined, 'x', 42, [], true]) {
    const result = normalizeAstrbotWeeklyConfig(input)
    assert.deepEqual(result, { ...DEFAULT_ASTRBOT_WEEKLY_CONFIG })
  }
})

test('归一化输出恰好覆盖全部键，且布尔项均为布尔', () => {
  const result = normalizeAstrbotWeeklyConfig({})
  const expectedKeys = ['layoutStyle', 'listColumns', ...ASTRBOT_WEEKLY_BOOLEAN_KEYS].sort()
  assert.deepEqual(Object.keys(result).sort(), expectedKeys)
  for (const key of ASTRBOT_WEEKLY_BOOLEAN_KEYS) {
    assert.equal(typeof result[key], 'boolean', `${key} 应为布尔值`)
  }
})

test('排他性：boolean 之外的脏值不得进入结果', () => {
  const result = normalizeAstrbotWeeklyConfig({
    layoutStyle: 'table',
    listColumns: 1,
    showCover: 'yes',
    showTitle: 1,
    showVotes: null
  })
  assert.equal(result.showCover, DEFAULT_ASTRBOT_WEEKLY_CONFIG.showCover)
  assert.equal(result.showTitle, DEFAULT_ASTRBOT_WEEKLY_CONFIG.showTitle)
  assert.equal(result.showVotes, DEFAULT_ASTRBOT_WEEKLY_CONFIG.showVotes)
})

test('排版样式白名单只有一个权威定义', () => {
  assert.deepEqual([...ASTRBOT_WEEKLY_LAYOUTS], ['classic', 'table'])
})
