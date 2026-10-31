import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  SUPER_ADMIN_ONLY_SETTING_FIELDS,
  findSuperAdminOnlySettingFields,
  stripSuperAdminOnlySettingFields
} from '../../app/utils/settingsPermissions.ts'

// 系统设置权限边界：涉及用户数据与凭据的字段归超级管理员，运营配置留给普通管理员
const read = (relative: string) => readFileSync(join(import.meta.dirname, relative), 'utf8')

const INDEX_POST = read('../../server/api/admin/system-settings/index.post.ts')
const INDEX_GET = read('../../server/api/admin/system-settings/index.ts')
const ENV_OAUTH_GET = read('../../server/api/admin/system-settings/env-oauth.get.ts')
const ENV_OAUTH_IMPORT = read('../../server/api/admin/system-settings/env-oauth-import.post.ts')
const CLEAR_BINDINGS = read('../../server/api/admin/system-settings/clear-aggregate-bindings.post.ts')
const SCHEMA = read('../../app/drizzle/schema.ts')
const USE_PERMISSIONS = read('../../app/composables/usePermissions.ts')
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

test('读写接口与子接口按角色把关', () => {
  assert.match(INDEX_POST, /user\.role !== 'SUPER_ADMIN'[\s\S]*findSuperAdminOnlySettingFields\(body\)/)
  assert.match(INDEX_POST, /statusCode: 403/)
  assert.match(INDEX_GET, /stripSuperAdminOnlySettingFields\(masked\)/)
  for (const [name, source] of [
    ['env-oauth.get', ENV_OAUTH_GET],
    ['env-oauth-import', ENV_OAUTH_IMPORT],
    ['clear-aggregate-bindings', CLEAR_BINDINGS]
  ] as const) {
    assert.match(source, /user\.role !== 'SUPER_ADMIN'/, `${name} 应仅限超级管理员`)
    assert.doesNotMatch(source, /\['ADMIN', 'SUPER_ADMIN'\]\.includes/, `${name} 不应再放行普通管理员`)
  }
})

test('普通管理员界面不含站点配置与机器人配置入口，表单不提交超管字段', () => {
  const adminPages = USE_PERMISSIONS.match(/if \(role === 'ADMIN'\) \{\s*return \[([\s\S]*?)\]/)?.[1] ?? ''
  assert.ok(adminPages, '未找到 ADMIN 可访问页面列表')
  for (const page of ['site-config', 'smtp-config', 'database', 'api-keys']) {
    assert.doesNotMatch(adminPages, new RegExp(`'${page}'`), `普通管理员不应有 ${page} 入口`)
  }
  assert.match(SITE_CONFIG_UI, /stripSuperAdminOnlySettingFields\(configToSave\)/)
})
