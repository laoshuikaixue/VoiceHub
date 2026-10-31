/**
 * 自定义 CSS 策略（前后端共用单一来源）
 * 上限值、`</style>` 识别与注入前的兜底清洗，服务端校验与后台输入框约束共用本模块。
 */

// 长度上限：整段内联进每个 SSR 页面，过大直接拖慢首屏
// 后台提示文案 siteConfig.customCssHint（zh/en）中的数值与此常量一致，由测试校验
export const CUSTOM_CSS_MAX_LENGTH = 64 * 1024

// 出现 </style> 会提前闭合样式标签，使后续内容按 HTML 解析
const STYLE_CLOSER_PATTERN = /<\s*\/\s*style[\s>]/i
const STYLE_CLOSER_PREFIX = /<\s*\/\s*style/gi
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
