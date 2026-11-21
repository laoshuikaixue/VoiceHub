import assert from 'node:assert/strict'
import test from 'node:test'
import { hasAdminPermission, PRIV_ORGANIZATION_LABEL, resolveEffectivePermissions } from '../../app/utils/admin-permissions.ts'
import { applyOrganizationLabels, organizationLabels, parseOrganizationLabel } from '../../app/utils/organization-labels.ts'

test('组织显示名称校验允许恢复默认值，并拦截不可见字符和过长值', () => {
  assert.equal(parseOrganizationLabel('  部门  '), '部门')
  assert.equal(parseOrganizationLabel(' '), '')
  assert.equal(parseOrganizationLabel('值\u200B'), null)
  assert.equal(parseOrganizationLabel('<span>'), null)
  assert.equal(parseOrganizationLabel('学'.repeat(25)), null)
  assert.equal(organizationLabels({ organizationLabelZh: '' }).zh, '班级')
  assert.equal(organizationLabels({ organizationLabelEn: '<>' }).en, 'Class')
})

test('组织显示名称只替换文案标记，保持原有键和已有组织内容', () => {
  const dictionary = { class: '年级⟪org.zh⟫', sample: ['职教学院'], action: (name: string) => '⟪org.en⟫ ' + name }
  const translated = applyOrganizationLabels(dictionary, organizationLabels({ organizationLabelZh: '部门', organizationLabelEn: 'Department' }))
  assert.equal(translated.class, '年级部门')
  assert.equal(translated.action('职教学院'), 'Department 职教学院')
  assert.deepEqual(translated.sample, ['职教学院'])
  assert.equal(dictionary.class, '年级⟪org.zh⟫')
})

test('站点设置写入和特权域通配均不会授予超级管理员独有的组织名称权限', () => {
  const canEdit = (perms: string[]) => hasAdminPermission({ perms }, PRIV_ORGANIZATION_LABEL)
  assert.equal(canEdit(resolveEffectivePermissions({ role: 'SUPER_ADMIN' })), true)
  assert.equal(canEdit(resolveEffectivePermissions({ role: 'ADMIN' })), false)
  assert.equal(canEdit(['priv:*', 'system-settings:write']), false)
  assert.equal(canEdit(['*', '!priv:*']), false)
})
