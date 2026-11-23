import assert from 'node:assert/strict'
import test from 'node:test'
import { hasAdminPermission, PRIV_ORGANIZATION_LABEL, resolveEffectivePermissions } from '../../app/utils/admin-permissions.ts'
import { applyOrganizationLabels, organizationLabels, parseOrganizationLabel } from '../../app/utils/organization-labels.ts'
import { admin as zhAdmin } from '../../app/utils/locale/zh-CN.ts'
import { admin as enAdmin } from '../../app/utils/locale/en-US.ts'

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

test('分类字段入口固定，通知预览和统计使用同一自定义名称', () => {
  for (const organizationLabelZh of ['班级', '学院', '二级学院']) {
    const labels = organizationLabels({ organizationLabelZh, organizationLabelEn: 'Department' })
    const zh = applyOrganizationLabels(zhAdmin, labels)
    assert.equal(zh.sidebar.menu.gradeClass, '分类字段')
    assert.equal(zh.gradeClass.title, '分类字段')
    assert.equal(zh.gradeClass.classCount(2), `共 2 个${organizationLabelZh}`)
    assert.equal(zh.notificationSender.scopeDescriptions.class('2026', '信息工程'), `2026 · ${organizationLabelZh}：信息工程`)
    assert.equal(zh.notificationSender.scopeDescriptions.class('2026', '1班'), `2026 · ${organizationLabelZh}：1班`)
    const en = applyOrganizationLabels(enAdmin, labels)
    assert.equal(en.sidebar.menu.gradeClass, 'Classification Fields')
    assert.equal(en.notificationSender.scopeDescriptions.class('2026', 'Engineering'), 'Grade 2026 · Department: Engineering')
  }
})
