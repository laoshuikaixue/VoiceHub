import assert from 'node:assert/strict'
import test from 'node:test'
import { parseClassInput } from '../../app/utils/grade-class-input.ts'

test('数字区间生成对应数量的班名', () => {
  assert.deepEqual(parseClassInput('1-3'), ['1班', '2班', '3班'])
  assert.deepEqual(parseClassInput('1-1'), ['1班'])
})

test('逗号分隔与区间可混合使用并去重', () => {
  const result = parseClassInput('一班,3-4,一班')
  assert.deepEqual(result, ['一班', '3班', '4班'])
})

test('支持中文/英文逗号、换行、分号分隔', () => {
  assert.deepEqual(parseClassInput('一班，二班\n三班；4-5'), ['一班', '二班', '三班', '4班', '5班'])
})

test('非法区间按字面保留', () => {
  assert.deepEqual(parseClassInput('5-3'), ['5-3'])
  assert.deepEqual(parseClassInput('一-三'), ['一-三'])
})

test('超长区间按字面保留（上限 100 防呆）', () => {
  const result = parseClassInput('1-101')
  assert.deepEqual(result, ['1-101'])
})

test('空输入与非字符串返回空数组', () => {
  assert.deepEqual(parseClassInput(''), [])
  assert.deepEqual(parseClassInput(undefined), [])
})