import { CUSTOM_CSS_MAX_LENGTH } from '../config/constants.ts'

/**
 * 自定义 CSS 注入前的兜底清洗。
 *
 * 备份恢复等旁路写入不经过保存接口校验，此处按同一口径收敛：
 * - 剔除会提前闭合 `<style>` 的标签（`<style>` 是 raw-text 元素，仅以 `</style` 终止）；
 *   反复剔除直至稳定，避免一次删除后两侧残留拼接出新的闭合标签；
 * - 截断到长度上限，防止超大样式表整段内联进每个 SSR 页面。
 */
export function sanitizeCustomCss(css: string): string {
  let safe = css || ''
  let previous = ''
  while (previous !== safe) {
    previous = safe
    safe = safe.replace(/<\s*\/\s*style/gi, '')
  }
  return safe.slice(0, CUSTOM_CSS_MAX_LENGTH)
}
