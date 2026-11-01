import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SUPER_ADMIN_ONLY_SETTING_FIELDS,
  findSuperAdminOnlySettingFields,
  stripSuperAdminOnlySettingFields
} from '../../app/utils/settingsPermissions.ts'
import {
  ROLE_PERMISSION_TEMPLATES_DEFAULT,
  hasAdminPermission,
  accessiblePages,
  hasAllPermissions,
  hasAnyPermission,
  resolveEffectivePermissions,
  PRIV_ADMIN_CONSOLE
} from '../../app/utils/admin-permissions.ts'
import { resolveAdminRouteGuard } from '../../server/utils/admin-permission-routes.ts'

// 系统设置权限边界：涉及用户数据与凭据的字段归超级管理员，运营配置留给普通管理员
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const INDEX_POST = read('../../server/api/admin/system-settings/index.post.ts')
const INDEX_GET = read('../../server/api/admin/system-settings/index.ts')
const ENV_OAUTH_GET = read('../../server/api/admin/system-settings/env-oauth.get.ts')
const ENV_OAUTH_IMPORT = read('../../server/api/admin/system-settings/env-oauth-import.post.ts')
const CLEAR_BINDINGS = read('../../server/api/admin/system-settings/clear-aggregate-bindings.post.ts')
const SCHEMA = read('../../app/drizzle/schema.ts')
const SITE_CONFIG_UI = read('../../app/components/Admin/SiteConfigManager.vue')

const SUPER_ADMIN_FIELDS = new Set<string>(SUPER_ADMIN_ONLY_SETTING_FIELDS as readonly string[])

const SYSTEM_SETTINGS_BLOCK =
  SCHEMA.match(/export const systemSettings = pgTable\([\s\S]*?\n\}\);/)?.[0] ?? ''

const WRITABLE_FIELDS = new Set(
  [...INDEX_POST.matchAll(/body\.(\w+)\s*!==\s*undefined/g)].map((match) => match[1])
)

// 命中即属用户数据/凭据/出站目标类，必须收归超级管理员
const MUST_BE_SUPER_ADMIN = [
  /oauth/i,
  /^smtp/,
  /(Secret|AppKey|Password|Token|SiteKey)$/,
  /^captcha/,
  /^turnstile/,
  /^esa/,
  /^statisticsCode/,
  /^customCss/,
  /^legalConsent/,
  /^hideStudentInfo/,
  /^allowAnonymousSubmission/,
  /^allowRegister/,
  /^registerRequires/,
  /^registerEmailRequired/,
  /^forcePasswordChangeOnFirstLogin/,
  /^telemetryEnabled/,
  /^defaultTheme$/,
  /^enabledThemes$/,
  /^siteTitle$/,
  /^siteDescription$/,
  /^siteLogoUrl$/,
  /^schoolLogo/,
  /^(icpNumber|gonganNumber|showBeianIcon)$/,
  /^(submissionGuidelines|showBlacklistKeywords|submissionNoteRequiresApproval)$/,
  /^astrbot(Enabled|Token|BaseUrl|PushMode|BroadcastEnabled|GroupTargets|Platforms|WeeklyConfig|GroupEvents|GroupThrottle)$/
]

// 日常运营配置（有 ADMIN 可达的编辑入口），不得被收权
const MUST_STAY_WITH_ADMIN = [
  /^submissionRestrictionScope$/,
  /^same(Song|Artist)RestrictionHours$/,
  /^enable(Submission|CardCode|Replay|Collaborative|Global|RequestTime|PlayTime|SubmissionLimit|SubmissionRestriction|SubmissionRemarks)/,
  /^requireCardCodeForRequests$/,
  /^enableCardCodeLimitBypass$/,
  /^(daily|weekly|monthly)SubmissionLimit$/,
  /^global(Daily|Weekly|Monthly)SubmissionLimit$/,
  /^playSlotRequired$/,
  /^scheduleDays(Before|After)(Enabled)?$/,
  /^forceBlockAllRequests$/,
  /^enabledPlatforms$/,
  /^platformOrder$/
]

const isSuperAdminOnly = (field: string) =>
  MUST_BE_SUPER_ADMIN.some((pattern) => pattern.test(field))
const isKeepForAdmin = (field: string) => MUST_STAY_WITH_ADMIN.some((pattern) => pattern.test(field))

test('清单字段都是 systemSettings 的真实列', () => {
  assert.ok(SYSTEM_SETTINGS_BLOCK, '未能定位 systemSettings 表定义')
  for (const field of SUPER_ADMIN_ONLY_SETTING_FIELDS) {
    assert.ok(SYSTEM_SETTINGS_BLOCK.includes(`${field}:`), `schema 缺字段：${field}`)
  }
  // 带掩码比较的写入字段也须被提取到，否则下一条断言会假绿
  assert.ok(WRITABLE_FIELDS.has('aggregateOAuthAppKey'), '写入字段提取失效')
  assert.ok(WRITABLE_FIELDS.has('smtpPassword'), '写入字段提取失效')
})

test('可写字段中的凭据与用户数据类全部收归超级管理员', () => {
  const leaked = [...WRITABLE_FIELDS].filter((field) => isSuperAdminOnly(field) && !SUPER_ADMIN_FIELDS.has(field))
  assert.deepEqual(leaked, [], `以下敏感字段未收权：${leaked.join(', ')}`)
})

test('运营配置未被误收，普通管理员仍可维护', () => {
  const overreached = [...WRITABLE_FIELDS].filter(
    (field) => isKeepForAdmin(field) && SUPER_ADMIN_FIELDS.has(field)
  )
  assert.deepEqual(overreached, [], `以下运营字段不应收权：${overreached.join(', ')}`)
})

test('剔除与命中函数按清单工作', () => {
  assert.deepEqual(
    findSuperAdminOnlySettingFields({ dailySubmissionLimit: 5, smtpHost: 'smtp', astrbotToken: 't' }),
    ['smtpHost', 'astrbotToken']
  )
  const stripped = stripSuperAdminOnlySettingFields({
    dailySubmissionLimit: 5,
    siteTitle: 'VoiceHub',
    smtpHost: 'smtp',
    hideStudentInfo: true,
    platformOrder: '[]'
  })
  // 站点文案与凭据类被剔除，限额与音源平台留给普通管理员
  assert.deepEqual(Object.keys(stripped).sort(), ['dailySubmissionLimit', 'platformOrder'])
  assert.deepEqual(findSuperAdminOnlySettingFields(null), [])
})

test('读写接口字段分区按权限码把关，默认角色与子接口守卫保持一致', () => {
  assert.match(INDEX_POST, /!hasAdminPermission\(user, 'system-settings:secrets'\)[\s\S]*findSuperAdminOnlySettingFields\(body\)/)
  assert.match(INDEX_POST, /statusCode: 403/)
  assert.match(INDEX_GET, /stripSuperAdminOnlySettingFields\(masked\)/)
  assert.doesNotMatch(ENV_OAUTH_GET, /\['ADMIN', 'SUPER_ADMIN'\]\.includes/, 'env-oauth.get 不应再放行普通管理员')
  assert.doesNotMatch(ENV_OAUTH_IMPORT, /\['ADMIN', 'SUPER_ADMIN'\]\.includes/)
  assert.doesNotMatch(CLEAR_BINDINGS, /\['ADMIN', 'SUPER_ADMIN'\]\.includes/)
  for (const [pathname, method] of [
    ['/api/admin/system-settings/env-oauth', 'GET'],
    ['/api/admin/system-settings/env-oauth-import', 'POST'],
    ['/api/admin/system-settings/clear-aggregate-bindings', 'POST']
  ] as const) {
    const guard = resolveAdminRouteGuard(pathname, method)
    assert.ok(guard && !guard.deny, `${pathname} 缺少守卫登记`)
    assert.ok(guard && guard.any.includes('system-settings:secrets'), `${pathname} 应限定凭据权限码`)
    for (const role of ['USER', 'SONG_ADMIN', 'ADMIN']) {
      const perms = resolveEffectivePermissions({ role }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
      assert.ok(
        !(hasAllPermissions(perms, [PRIV_ADMIN_CONSOLE]) && hasAnyPermission(perms, guard!.any)),
        `${role} 不应访问 ${pathname}`
      )
    }
    const superPerms = resolveEffectivePermissions({ role: 'SUPER_ADMIN' }, ROLE_PERMISSION_TEMPLATES_DEFAULT)
    assert.ok(hasAnyPermission(superPerms, guard!.any), `SUPER_ADMIN 应可访问 ${pathname}`)
  }
})

test('保存设置的响应与读取接口一致，普通管理员无法通过保存运营字段读取超管配置', () => {
  const settings = { dailySubmissionLimit: 7, smtpHost: 'smtp.private', customOAuthClientId: 'private-client',
    astrbotGroupTargets: '["private-group"]', legalConsentDocuments: 'private-documents' }
  for (const source of [INDEX_GET, INDEX_POST]) {
    const expression = source.match(/return hasAdminPermission[^\r\n]*/)?.[0]
    assert.ok(expression)
    const respond = new Function('user', 'masked', 'stripSuperAdminOnlySettingFields', 'hasAdminPermission', expression)
    assert.deepEqual(respond({ perms: resolveEffectivePermissions({ role: 'ADMIN' }) }, settings, stripSuperAdminOnlySettingFields, hasAdminPermission), { dailySubmissionLimit: 7 })
    assert.deepEqual(respond({ perms: ['*'] }, settings, stripSuperAdminOnlySettingFields, hasAdminPermission), settings)
  }
})

test('普通管理员界面不含站点配置与机器人配置入口，表单不提交超管字段', () => {
  const adminPages = accessiblePages(resolveEffectivePermissions({ role: 'ADMIN' }, ROLE_PERMISSION_TEMPLATES_DEFAULT))
  assert.ok(adminPages.length, '未找到 ADMIN 可访问页面列表')
  for (const page of ['site-config', 'smtp-config', 'database', 'api-keys']) {
    assert.ok(!adminPages.includes(page), `普通管理员不应有 ${page} 入口`)
  }
  assert.match(SITE_CONFIG_UI, /stripSuperAdminOnlySettingFields\(configToSave\)/)
})
