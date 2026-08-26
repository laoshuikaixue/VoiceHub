import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveGradeClassOptions,
  smartSort
} from '../../server/utils/grade-class-core.ts'

test('配置非空时优先使用配置项', () => {
  const config = [{ grade: '高一', class: '一班' }]
  const fallback = [{ grade: '高二', class: '二班' }]

  assert.deepEqual(resolveGradeClassOptions(config, fallback), config)
})

test('配置为空时回退到用户提取并按学段排序', () => {
  const config = []
  const fallback = [
    { grade: '高二', class: '二班' },
    { grade: '高一', class: '一班' }
  ]

  const result = resolveGradeClassOptions(config, fallback)
  assert.deepEqual(result.map((item) => item.grade), ['高一', '高二'])
})

test('过滤年级或班级为空的数据项', () => {
  const items = [
    { grade: '高一', class: '一班' },
    { grade: '', class: '二班' },
    { grade: '高一', class: '' }
  ]

  const result = resolveGradeClassOptions(items, [])
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], { grade: '高一', class: '一班' })
})

test('smartSort 按学段权重排序，未知学段按字典序', () => {
  assert.equal(smartSort('初一', '高一') < 0, true)
  assert.equal(smartSort('高一', '高二') < 0, true)
  assert.equal(smartSort('教师', '高一') > 0, true)
  const values = ['十年级', '二年级']
  values.sort(smartSort)
  assert.deepEqual(values, ['二年级', '十年级'])
})