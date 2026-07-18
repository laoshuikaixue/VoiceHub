import { marked } from 'marked'

// 配置 marked：支持 GFM（表格、任务列表等），换行自动转 <br>
marked.use({
  gfm: true,
  breaks: true
})

// 禁止原始 HTML 渲染，从源头防止 XSS
// 即便管理员配置中含 HTML，也不会被渲染
marked.use({
  renderer: {
    html() { return '<!-- raw HTML blocked -->' }
  }
})

/**
 * 将 Markdown 文本渲染为安全 HTML
 * marked 已禁用原始 HTML 透传，输出在服务端和客户端均安全
 *
 * @param {string} text Markdown 文本
 * @returns {string} 安全的 HTML 字符串
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  return marked.parse(text)
}