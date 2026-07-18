import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 配置 marked：支持 GFM（表格、任务列表等），换行自动转 <br>
marked.use({
  gfm: true,
  breaks: true
})

// 模块级注册 hook：为所有 <a> 标签添加安全属性，仅注册一次
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * 将 Markdown 文本安全渲染为 HTML
 * 使用 DOMPurify 白名单模式防止 XSS
 *
 * @param {string} text Markdown 文本
 * @returns {string} 安全的 HTML 字符串
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return ''

  const raw = marked.parse(text)

  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'del', 'code', 'pre',
      'a', 'img',
      'ul', 'ol', 'li',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  })
}