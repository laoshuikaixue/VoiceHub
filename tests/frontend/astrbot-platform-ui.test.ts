import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse, compileTemplate } from 'vue/compiler-sfc'
import { pages as zhPages, admin as zhAdmin } from '../../app/utils/locale/zh-CN.ts'
import { pages as enPages, admin as enAdmin } from '../../app/utils/locale/en-US.ts'

const source = (path: string) => readFileSync(new URL(`../../app/${path}`, import.meta.url), 'utf8')
const account = source('components/Account/SocialBindings.vue')
const admin = source('components/Admin/SmtpManager.vue')
const platforms = ['qq', 'wecom', 'dingtalk', 'lark']

test('account renders one card per enabled platform from the public status map', () => {
  assert.match(account, /v-for="platform in enabledPlatforms"/)
  assert.match(account, /status\.platforms/)
  for (const platform of platforms) assert.match(account, new RegExp(`'${platform}'`))
  assert.match(account, /\.enabled/)
  assert.match(account, /\.bound/)
  assert.doesNotMatch(account, /astrbotAccount|status\.qqId|status\.qqUserId|status\.astrbotEnabled|status\.isBound/)
  assert.match(account, /entry\?\.boundAt \|\| null/)
  assert.match(account, /platformStatus\[platform\]\.boundAt/)
  assert.doesNotMatch(account, /new Date\(.*boundAt|toLocaleString\(/)
})

test('account posts platform-scoped bind, unbind and test, preserving existing routes', () => {
  for (const route of ['bind-code', 'unbind', 'test']) {
    assert.match(account, new RegExp(`/api/notifications/astrbot/${route}`))
  }
  assert.match(account, /body: \{ platform \}/)
  assert.match(account, /api\/notifications\/settings/)
  assert.match(account, /api\/meow\/bind/)
  assert.match(account, /api\/user\/email\/bind/)
})

test('administrator loads and saves four platform toggles alongside existing settings', () => {
  assert.match(admin, /response\.astrbotPlatforms/)
  assert.match(admin, /astrbotPlatforms:.*astrbotPlatforms\.value|astrbotPlatforms:.*platforms/)
  for (const platform of platforms) assert.match(admin, new RegExp(`'${platform}'`))
  assert.match(admin, /astrbotBaseUrl/)
  assert.match(admin, /smtpEnabled/)
})

test('both locales have identical account and administrator platform message keys', () => {
  for (const [zh, en] of [
    [zhPages.account.social.astrbot, enPages.account.social.astrbot],
    [zhAdmin.astrbotManager, enAdmin.astrbotManager]
  ]) {
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
    assert.deepEqual(Object.keys(zh.platforms).sort(), platforms.toSorted())
    assert.deepEqual(Object.keys(en.platforms).sort(), platforms.toSorted())
  }
})

test('modified Vue templates compile without errors', () => {
  for (const [name, content] of [['SocialBindings.vue', account], ['SmtpManager.vue', admin]]) {
    const { descriptor, errors } = parse(content, { filename: name })
    assert.deepEqual(errors, [])
    assert.ok(descriptor.scriptSetup)
    const compiled = compileTemplate({ source: descriptor.template.content, filename: name, id: name })
    assert.deepEqual(compiled.errors, [])
  }
})

test('both locales provide all platform names and account/admin actions', () => {
  for (const language of ['zh-CN', 'en-US']) {
    const locale = source(`utils/locale/${language}.ts`)
    for (const platform of platforms) assert.match(locale, new RegExp(`${platform}:`))
    for (const key of ['testFailed', 'testSuccess', 'platforms', 'unbindMessage']) {
      assert.match(locale, new RegExp(`${key}:`))
    }
  }
})
