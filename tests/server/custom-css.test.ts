import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { stripSuperAdminOnlySettingFields } from '../../app/utils/settingsPermissions.ts'

const read = (url: string) => readFileSync(new URL(url, import.meta.url), 'utf8')

const INDEX_POST = read('../../server/api/admin/system-settings/index.post.ts')
const PLUGIN = read('../../server/plugins/custom-css.ts')
const CONSTANTS = read('../../server/config/constants.ts')
const ZH_LOCALE = read('../../app/utils/locale/zh-CN.ts')
const EN_LOCALE = read('../../app/utils/locale/en-US.ts')

const CUSTOM_CSS_KEYS = [
  'customCssSection',
  'customCss',
  'customCssEnabled',
  'customCssEnabledDesc',
  'customCssPlaceholder',
  'customCssHint'
]

test('自定义 CSS 属于超管专属字段，普通管理员提交时被剔除', () => {
  const stripped = stripSuperAdminOnlySettingFields({
    siteTitle: 'x',
    customCss: 'body{}',
    customCssEnabled: true
  })
  assert.deepEqual(Object.keys(stripped), ['siteTitle'])
})

test('写入校验限制长度并拒绝提前闭合的 style 标签', () => {
  assert.match(CONSTANTS, /export const CUSTOM_CSS_MAX_LENGTH = 64 \* 1024/)
  assert.match(INDEX_POST, /import \{[^}]*CUSTOM_CSS_MAX_LENGTH[^}]*\} from '~~\/server\/config\/constants'/s)
  assert.match(INDEX_POST, /css\.length > CUSTOM_CSS_MAX_LENGTH/)
  assert.match(INDEX_POST, /\/<\\s\*\\\/\\s\*style\[\\s>\]\/i\.test\(css\)/)
})

test('注入插件按开关生效、追加到 head 末尾并兜底剔除闭合标签', () => {
  assert.match(PLUGIN, /enabled: !!settings\.customCssEnabled/)
  assert.match(PLUGIN, /css\.replace\(\/<\\s\*\\\/\\s\*style\/gi, ''\)/)
  assert.match(PLUGIN, /html\.head\.push\(`<style data-custom-css>/)
  assert.match(PLUGIN, /hook\('render:html'/)
  // 与统计代码注入同一口径：TTL 缓存 + in-flight 去重，读取失败不写缓存
  assert.match(PLUGIN, /const CACHE_TTL_MS = 60 \* 1000/)
  assert.match(PLUGIN, /let inFlight: Promise/)
})

test('空 CSS 或关闭开关时不注入', () => {
  assert.match(PLUGIN, /if \(enabled && safeCss\.trim\(\) && Array\.isArray\(html\.head\)\)/)
})

test('自定义 CSS 文案中英词典键一致', () => {
  for (const key of CUSTOM_CSS_KEYS) {
    assert.match(ZH_LOCALE, new RegExp(`^ {2}${key}:`, 'm'), `zh-CN 缺文案键：${key}`)
    assert.match(EN_LOCALE, new RegExp(`^ {2}${key}:`, 'm'), `en-US 缺文案键：${key}`)
  }
})
