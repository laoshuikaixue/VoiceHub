import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

// 配置 marked：支持 GFM（表格、任务列表等），换行自动转 <br>
marked.use({
  gfm: true,
  breaks: true
})

// 禁止原始 HTML 渲染，从源头防止 XSS
marked.use({
  renderer: {
    html() { return '<!-- raw HTML blocked -->' }
  }
})

/**
 * 将 Markdown 文本渲染为安全 HTML
 * 两层防护：marked 禁用原始 HTML + DOMPurify 清洗（含 javascript: 协议链接）
 *
 * @param {string} text Markdown 文本
 * @returns {string} 安全的 HTML 字符串
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  const rawHtml = marked.parse(text)
  return DOMPurify.sanitize(rawHtml)
}