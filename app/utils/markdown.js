import { Marked } from 'marked'
import xss from 'xss'

// 创建独立的 marked 实例，避免全局污染和 HMR 重复注册
const markedInstance = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html() { return '<!-- raw HTML blocked -->' }
  }
})

// xss 白名单：默认白名单 + GFM 任务列表 checkbox + code 类名（为语法高亮预留）
const xssOptions = {
  whiteList: {
    ...xss.whiteList,
    input: ['type', 'checked', 'disabled'],
    code: ['class']
  }
}

/**
 * 将 Markdown 文本渲染为安全 HTML
 * 两层防护：marked 禁用原始 HTML + xss 清洗（禁 script、on* 事件、javascript: 协议）
 *
 * @param {string} text Markdown 文本
 * @returns {string} 安全的 HTML 字符串
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  const rawHtml = markedInstance.parse(text)
  return xss(rawHtml, xssOptions)
}