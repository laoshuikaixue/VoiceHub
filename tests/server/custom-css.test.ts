import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { stripSuperAdminOnlySettingFields } from '../../app/utils/settingsPermissions.ts'
import { sanitizeCustomCss } from '../../server/utils/custom-css.ts'
import { CUSTOM_CSS_MAX_LENGTH } from '../../server/config/constants.ts'

const read = (url: string) => readFileSync(new URL(url, import.meta.url), 'utf8')

const INDEX_POST = read('../../server/api/admin/system-settings/index.post.ts')
const PLUGIN = read('../../server/plugins/custom-css.ts')
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

const SERVER_ERROR_KEYS = ['SETTINGS_CUSTOM_CSS_TOO_LONG', 'SETTINGS_CUSTOM_CSS_STYLE_CLOSER']

test('自定义 CSS 属于超管专属字段，普通管理员提交时被剔除', () => {
  const stripped = stripSuperAdminOnlySettingFields({
    enabledPlatforms: ['netease'],
    customCss: 'body{}',
    customCssEnabled: true
  })
  assert.deepEqual(Object.keys(stripped), ['enabledPlatforms'])
})

test('注入清洗剔除提前闭合的 style 标签', () => {
  // 只剔除 </style 前缀，残留的 > 是无效 CSS token，不会再闭合标签
  assert.equal(sanitizeCustomCss('a{color:red}</style><img src=x onerror=1>'), 'a{color:red}><img src=x onerror=1>')
  // 一次剔除后两侧残留会拼出新的 </style>（仍是闭合标签），须反复剔除直至稳定
  assert.equal(sanitizeCustomCss('</sty</stylele>'), '>')
  assert.equal(sanitizeCustomCss('</style</style>'), '>')
  // 标签名内的空格与大小写同样被识别
  assert.equal(sanitizeCustomCss('a<!--</ STYLE >b'), 'a<!-- >b')
  for (const css of ['</sty</stylele>', '</style</style>', 'a<!--</ STYLE >b']) {
    assert.doesNotMatch(sanitizeCustomCss(css), /<\s*\/\s*style/i)
  }
})

test('注入清洗截断到长度上限', () => {
  const long = 'x'.repeat(CUSTOM_CSS_MAX_LENGTH + 1000)
  assert.equal(sanitizeCustomCss(long).length, CUSTOM_CSS_MAX_LENGTH)
  assert.equal(sanitizeCustomCss('a{}'), 'a{}')
  assert.equal(sanitizeCustomCss(undefined as unknown as string), '')
})

test('注入插件复用清洗并追加到 head 末尾', () => {
  assert.match(PLUGIN, /import \{ sanitizeCustomCss \} from '~~\/server\/utils\/custom-css'/)
  assert.match(PLUGIN, /const safeCss = sanitizeCustomCss\(css\)/)
  assert.match(PLUGIN, /html\.head\.push\(`<style data-custom-css>\$\{safeCss\}<\/style>`\)/)
  assert.match(PLUGIN, /hook\('render:html'/)
  // 开关关闭或 CSS 为空都不注入
  assert.match(PLUGIN, /if \(enabled && safeCss\.trim\(\) && Array\.isArray\(html\.head\)\)/)
})

test('保存校验限长并拒绝提前闭合标签，使用专属错误码', () => {
  assert.match(INDEX_POST, /css\.length > CUSTOM_CSS_MAX_LENGTH/)
  assert.match(INDEX_POST, /SERVER_ERROR_CODES\.SETTINGS_CUSTOM_CSS_TOO_LONG/)
  assert.match(INDEX_POST, /SERVER_ERROR_CODES\.SETTINGS_CUSTOM_CSS_STYLE_CLOSER/)
  assert.match(INDEX_POST, /\{ params: \[CUSTOM_CSS_MAX_LENGTH\] \}/)
})

test('错误码在中英词典中键完全对齐', () => {
  for (const key of SERVER_ERROR_KEYS) {
    for (const [name, source] of [['zh-CN', ZH_LOCALE], ['en-US', EN_LOCALE]] as const) {
      assert.match(source, new RegExp(`^ {2}${key}:`, 'm'), `${name} 缺错误码文案：${key}`)
    }
  }
})

test('提示文案里的长度上限与常量一致', () => {
  for (const [name, source] of [['zh-CN', ZH_LOCALE], ['en-US', EN_LOCALE]] as const) {
    const hint = source.match(/customCssHint:\s*\n?\s*'([^']*)'/)?.[1] || ''
    assert.ok(hint.includes(String(CUSTOM_CSS_MAX_LENGTH)), `${name} 的 customCssHint 未包含 ${CUSTOM_CSS_MAX_LENGTH}`)
  }
})

test('自定义 CSS 文案中英词典键一致', () => {
  for (const key of CUSTOM_CSS_KEYS) {
    assert.match(ZH_LOCALE, new RegExp(`^ {2}${key}:`, 'm'), `zh-CN 缺文案键：${key}`)
    assert.match(EN_LOCALE, new RegExp(`^ {2}${key}:`, 'm'), `en-US 缺文案键：${key}`)
  }
})
