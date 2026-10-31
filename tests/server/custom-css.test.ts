import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { stripSuperAdminOnlySettingFields } from '../../app/utils/settingsPermissions.ts'
import {
  CUSTOM_CSS_MAX_LENGTH,
  containsStyleCloser,
  sanitizeCustomCss,
  trimCustomCss
} from '../../app/utils/custom-css-policy.ts'

const read = (url: string) => readFileSync(new URL(url, import.meta.url), 'utf8')

const INDEX_POST = read('../../server/api/admin/system-settings/index.post.ts')
const PLUGIN = read('../../server/plugins/custom-css.ts')
const COMPONENT = read('../../app/components/Admin/SiteConfigManager.vue')
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
  for (const css of ['</sty</stylele>', '</style</style>', 'a<!--</ STYLE >b']) {
    assert.doesNotMatch(sanitizeCustomCss(css), /<\s*\/\s*style/i)
  }
})

test('注入清洗截断到长度上限且不撕裂代理对', () => {
  assert.equal(sanitizeCustomCss('x'.repeat(CUSTOM_CSS_MAX_LENGTH + 1000)).length, CUSTOM_CSS_MAX_LENGTH)
  const splitPair = 'x'.repeat(CUSTOM_CSS_MAX_LENGTH - 1) + '😀'
  const cut = sanitizeCustomCss(splitPair)
  assert.equal(cut.length, CUSTOM_CSS_MAX_LENGTH - 1)
  assert.doesNotMatch(cut, /[\uD800-\uDBFF]$/, '截断点残留孤立高位代理项')
  assert.equal(sanitizeCustomCss('a{}'), 'a{}')
  assert.equal(sanitizeCustomCss(undefined), '')
  assert.equal(sanitizeCustomCss(42), '')
})

// 以下 5 种写法经 headless Chrome 153 实测会提前闭合 <style>
const CLOSER_VARIANTS = [
  'a{color:red}</style><b>x</b>',
  'a{color:red}</style/><b>x</b>',
  'a{color:red}</STYLE   ><b>x</b>',
  'a{color:red}</style\t/><b>x</b>',
  'a{color:red}</style\n/><b>x</b>'
]
// 浏览器不闭合、但清洗会剔除该前缀的写法，同样在保存时拒绝，避免存下的文本被静默改写
const MUTATED_VARIANTS = [
  'a{color:red}</style" foo><b>x</b>',
  'a{color:red}</style'
]
const CLEAN_VARIANTS = [
  'a::before{content:"<b>"}',
  '.style-name{color:red}',
  '</sty'
]

test('闭合标签识别与清洗同一口径', () => {
  for (const css of [...CLOSER_VARIANTS, ...MUTATED_VARIANTS]) {
    assert.equal(containsStyleCloser(css), true, `漏判会被清洗的写法：${JSON.stringify(css)}`)
    assert.doesNotMatch(sanitizeCustomCss(css), /<\s*\/\s*style/i)
  }
  for (const css of CLEAN_VARIANTS) {
    assert.equal(containsStyleCloser(css), false, `误判合法写法：${JSON.stringify(css)}`)
    assert.equal(sanitizeCustomCss(css), css)
  }
  assert.equal(containsStyleCloser(null), false)
  assert.equal(trimCustomCss('  a{}  '), 'a{}')
  assert.equal(trimCustomCss(null), '')
})

test('注入插件复用共享清洗并追加到 head 末尾', () => {
  assert.match(PLUGIN, /import \{ sanitizeCustomCss \} from '~\/utils\/custom-css-policy'/)
  assert.match(PLUGIN, /const safeCss = sanitizeCustomCss\(css\)/)
  assert.match(PLUGIN, /html\.head\.push\(`<style data-custom-css>\$\{safeCss\}<\/style>`\)/)
  assert.match(PLUGIN, /hook\('render:html'/)
  // 开关关闭或 CSS 为空都不注入
  assert.match(PLUGIN, /if \(enabled && safeCss\.trim\(\) && Array\.isArray\(html\.head\)\)/)
})

test('保存校验走共享模块并返回专属错误码与参数', () => {
  for (const snippet of [
    `import { CUSTOM_CSS_MAX_LENGTH, containsStyleCloser, trimCustomCss } from '~/utils/custom-css-policy'`,
    'const css = trimCustomCss(body.customCss)',
    'if (css.length > CUSTOM_CSS_MAX_LENGTH) {',
    'if (containsStyleCloser(css)) {',
    'updateData.customCss = css || null',
    'SERVER_ERROR_CODES.SETTINGS_CUSTOM_CSS_TOO_LONG',
    'SERVER_ERROR_CODES.SETTINGS_CUSTOM_CSS_STYLE_CLOSER',
    '{ params: [CUSTOM_CSS_MAX_LENGTH] }'
  ]) {
    assert.ok(INDEX_POST.includes(snippet), `保存接口缺少写法：${snippet}`)
  }
})

test('开关关闭时前端不提交 CSS，避免残值校验阻塞整表单', () => {
  for (const snippet of [
    'const customCssDraft = trimCustomCss(formData.value.customCss)',
    '...(formData.value.customCssEnabled ? { customCss: customCssDraft } : {}),',
    'if (!formData.value.customCssEnabled) delete requestPayload.customCss'
  ]) {
    assert.ok(COMPONENT.includes(snippet), `SiteConfigManager 缺少写法：${snippet}`)
  }
  // formData 仍带着库中的 CSS，条件展开不足以挡住该键，必须显式删键
  assert.ok(
    COMPONENT.split('...(formData.value.customCssEnabled ? { customCss: customCssDraft } : {}),').length - 1 >= 2,
    '保存成功后未按同一口径回填 customCss'
  )
})

test('前端输入框上限取自共享常量，与服务端一致', () => {
  for (const snippet of [
    `import { CUSTOM_CSS_MAX_LENGTH, trimCustomCss } from '~/utils/custom-css-policy'`,
    ':maxlength="CUSTOM_CSS_MAX_LENGTH"',
    'const customCssLength = computed(() => trimCustomCss(formData.value.customCss).length)',
    '{{ customCssLength }} / {{ CUSTOM_CSS_MAX_LENGTH }}'
  ]) {
    assert.ok(COMPONENT.includes(snippet), `SiteConfigManager 缺少写法：${snippet}`)
  }
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
