/**
 * 自定义 CSS 策略（前后端共用单一来源）
 * 上限值、`</style>` 识别与注入前的兜底清洗，服务端校验与后台输入框约束共用本模块。
 */

// 长度上限：整段内联进每个 SSR 页面，过大直接拖慢首屏
// 后台提示文案 siteConfig.customCssHint（zh/en）中的数值与此常量一致，由测试校验
export const CUSTOM_CSS_MAX_LENGTH = 64 * 1024

// `<style>` 是 raw-text 元素，标签名后的空白、/ 或 > 都会提前闭合标签，使后续内容按 HTML 解析
// 判定与清洗共用同一前缀：凡是注入时会被剔除的文本，保存时一律拒绝，保证存下的内容与生效内容一致
const STYLE_CLOSER_PREFIX = /<\s*\/\s*style/gi
const STYLE_CLOSER_PATTERN = /<\s*\/\s*style/i
const HIGH_SURROGATE_TAIL = /[\uD800-\uDBFF]$/

export function containsStyleCloser(css: unknown): boolean {
  return STYLE_CLOSER_PATTERN.test(typeof css === 'string' ? css : '')
}

export function trimCustomCss(css: unknown): string {
  return typeof css === 'string' ? css.trim() : ''
}

/**
 * 注入 SSR 前的兜底清洗，覆盖备份恢复等不经保存接口校验的旁路写入。
 * `<style>` 是 raw-text 元素，仅以 `</style` 终止，因此剔除该前缀即可阻断逃逸；
 * 反复剔除直至稳定，避免一次删除后两侧残留拼接出新的闭合标签。
 * 截断点若落在代理对中间会输出替换字符，回退一个码元。
 */
export function sanitizeCustomCss(css: unknown): string {
  let safe = typeof css === 'string' ? css : ''
  let previous = ''
  while (previous !== safe) {
    previous = safe
    safe = safe.replace(STYLE_CLOSER_PREFIX, '')
  }
  const cut = safe.slice(0, CUSTOM_CSS_MAX_LENGTH)
  return HIGH_SURROGATE_TAIL.test(cut) ? cut.slice(0, -1) : cut
}
