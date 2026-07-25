import { Marked } from 'marked'
import xssPkg from 'xss'
const { escapeAttrValue, filterXSS, friendlyAttrValue, safeAttrValue, whiteList } = xssPkg

const ALLOWED_LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
const ALLOWED_IMAGE_SCHEMES = new Set(['http', 'https'])
const SAFE_RASTER_DATA_URL = /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const getUrlScheme = (value) => {
  const colonIndex = value.indexOf(':')
  if (colonIndex < 0) return null

  const pathBoundaryIndexes = ['/', '?', '#']
    .map((character) => value.indexOf(character))
    .filter((index) => index >= 0)
  const firstPathBoundary = pathBoundaryIndexes.length
    ? Math.min(...pathBoundaryIndexes)
    : Number.POSITIVE_INFINITY

  if (firstPathBoundary < colonIndex) return null

  const scheme = value.slice(0, colonIndex).replace(/\s/g, '')
  return /^[a-z][a-z0-9+.-]*$/i.test(scheme) ? scheme.toLowerCase() : 'invalid'
}

const isSafeUrl = (tag, name, value) => {
  const scheme = getUrlScheme(value)
  if (!scheme) return true

  if (name === 'href') return ALLOWED_LINK_SCHEMES.has(scheme)
  if (name === 'src') {
    if (tag === 'img' && scheme === 'data') return SAFE_RASTER_DATA_URL.test(value)
    return ALLOWED_IMAGE_SCHEMES.has(scheme)
  }

  return false
}

const sanitizeAttributeValue = (tag, name, value, cssFilter) => {
  if (name !== 'href' && name !== 'src') {
    return safeAttrValue(tag, name, value, cssFilter)
  }

  const normalizedValue = friendlyAttrValue(value).trim()
  return isSafeUrl(tag, name, normalizedValue) ? escapeAttrValue(normalizedValue) : ''
}

// 创建独立的 marked 实例，避免全局污染和 HMR 重复注册
const markedInstance = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html(token) {
      const rawHtml = typeof token === 'string' ? token : token.text
      return escapeHtml(rawHtml || '')
    }
  }
})

// xss 白名单：默认白名单 + GFM 任务列表 checkbox + code 类名（为语法高亮预留）
const xssOptions = {
  whiteList: {
    ...whiteList,
    input: ['type', 'checked', 'disabled'],
    code: ['class']
  },
  safeAttrValue: sanitizeAttributeValue
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
  return filterXSS(rawHtml, xssOptions)
}
