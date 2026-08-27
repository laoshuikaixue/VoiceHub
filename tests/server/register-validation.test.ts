import assert from 'node:assert/strict'
import test from 'node:test'
import { validateGradeClassPair, resolveGradeClassError, REMARK_MAX_LENGTH } from '../../server/utils/register-validation.ts'

test('年级和班级必须成对填写', () => {
  assert.equal(validateGradeClassPair('高一', '一班'), null)
  assert.equal(validateGradeClassPair('', ''), null)
  assert.equal(validateGradeClassPair(undefined, undefined), null)

  const onlyGrade = validateGradeClassPair('高一', '')
  assert.equal(onlyGrade?.code, 'AUTH_GRADE_CLASS_TOGETHER')

  const onlyClass = validateGradeClassPair('', '一班')
  assert.equal(onlyClass?.code, 'AUTH_GRADE_CLASS_TOGETHER')
})

test('站点开启注册必选年级班级时任一缺失按必填拒绝', () => {
  assert.equal(resolveGradeClassError('高一', '一班'), null)
  assert.equal(resolveGradeClassError('高一', '')?.code, 'AUTH_GRADE_CLASS_TOGETHER')
  assert.equal(resolveGradeClassError('高一', '一班', true), null)
  assert.equal(resolveGradeClassError('高一', '', true)?.code, 'AUTH_GRADE_CLASS_REQUIRED')
  assert.equal(resolveGradeClassError('', '一班', true)?.code, 'AUTH_GRADE_CLASS_REQUIRED')
  assert.equal(resolveGradeClassError('', '', true)?.code, 'AUTH_GRADE_CLASS_REQUIRED')
  assert.equal(resolveGradeClassError(undefined, undefined, true)?.code, 'AUTH_GRADE_CLASS_REQUIRED')
})

test('注册备注长度上限为 200', () => {
  assert.equal(REMARK_MAX_LENGTH, 200)
})
