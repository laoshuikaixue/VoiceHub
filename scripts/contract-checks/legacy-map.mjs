/**
 * 契约检查 · legacy 词表归一化（S1-6 / S1-4 · R-09 / R-32）。
 *
 * 为什么必须**逐条硬编码**期望值（防假绿）：
 *   上一轮 8 条映射里 7 条的目标 key 写成了 `songs.read` / `songs.write` / `card-codes.*`，
 *   与运行时比对的 catalog key 永不命中 → 历史 API Key 全量静默 403，而任何「同源自洽」
 *   的检查（拿映射表校验映射表）都会通过。故本文件把 8 条期望值写死：
 *   这是**有意的字面量**，catalog 改动导致不匹配时必须显式改这里并在 review 里说明。
 */

import assert from 'node:assert/strict'
import { LEGACY_PERMISSION_MAP, normalizePermission } from '../../shared/rbac/permission-catalog.js'

/** 冻结期望：legacy 冒号词表 → catalog key（8 条，逐条硬编码） */
const FROZEN_LEGACY_EXPECTATIONS = [
  ['schedules:read', 'schedule.read'],
  ['songs:read', 'song.read'],
  // 历史语义合并（slice-plan §5.1 / §8-③）：点歌申请 songs:request 与 songs:read 同为 song.read
  ['songs:request', 'song.read'],
  ['songs:write', 'song.write'],
  ['card-codes:read', 'card_codes.read'],
  ['card-codes:write', 'card_codes.write'],
  ['card-codes:delete', 'card_codes.delete'],
  ['backup:execute', 'backup.execute']
]

/** 负例：长得像但不是 catalog key，必须一律返回 null（禁止模糊容错） */
const FROZEN_NEGATIVE_CASES = [
  'songs.read',
  'song_read',
  'song.READ',
  'Song.read',
  'schedules.read',
  'cards:read',
  'song.read.all',
  'song',
  '.read',
  'song..read',
  '读歌.read'
]

function checkLegacyEntries() {
  assert.equal(
    Object.keys(LEGACY_PERMISSION_MAP).length,
    FROZEN_LEGACY_EXPECTATIONS.length,
    `legacy 词表条数 ${Object.keys(LEGACY_PERMISSION_MAP).length} != 冻结期望 ${FROZEN_LEGACY_EXPECTATIONS.length}`
  )

  const errors = []
  for (const [legacy, expected] of FROZEN_LEGACY_EXPECTATIONS) {
    const actual = normalizePermission(legacy)
    if (actual !== expected) {
      errors.push(`${legacy} → 期望 ${expected}，实际 ${actual}`)
    }
  }
  assert.equal(errors.length, 0, `legacy 归一化与冻结期望不符：${errors.join('；')}`)
}

function checkNegativeCases() {
  const errors = []
  for (const value of FROZEN_NEGATIVE_CASES) {
    const actual = normalizePermission(value)
    if (actual !== null) errors.push(`${value} → 期望 null，实际 ${actual}`)
  }
  for (const value of [null, undefined, 42, {}, [], true]) {
    const actual = normalizePermission(value)
    if (actual !== null) errors.push(`${JSON.stringify(value)} → 期望 null，实际 ${actual}`)
  }
  assert.equal(errors.length, 0, `非 catalog 值必须一律拒绝：${errors.join('；')}`)
}

function checkIdentity() {
  const errors = []
  for (const [legacy, expected] of FROZEN_LEGACY_EXPECTATIONS) {
    // 幂等性：归一化结果再归一化必须不变；且 catalog key 直接输入原样返回
    if (normalizePermission(expected) !== expected) {
      errors.push(`二次归一化不稳定：${expected}`)
    }
    if (normalizePermission(legacy) !== normalizePermission(normalizePermission(legacy))) {
      errors.push(`legacy 归一化不幂等：${legacy}`)
    }
  }
  if (normalizePermission(' song.read ') !== 'song.read') {
    errors.push('首尾空白未做 trim')
  }
  assert.equal(errors.length, 0, errors.join('；'))
}

export const checks = [
  { name: 'legacy 归一化：8 条冻结期望值逐条硬编码比对', run: checkLegacyEntries },
  { name: 'legacy 负例：近似 key / 非字符串一律返回 null', run: checkNegativeCases },
  { name: 'legacy 幂等：归一化结果稳定且可重复输入', run: checkIdentity }
]
