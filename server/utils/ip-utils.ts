import type { H3Event } from 'h3'
import { getHeaders } from 'h3'
import { isIP } from 'node:net'

const SUPPORTED_CLIENT_IP_HEADERS = new Set([
  'eo-connecting-ip',
  'eo-client-ip',
  'x-edgeone-client-ip',
  'edgeone-client-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'fastly-client-ip',
  'fly-client-ip',
  'x-nf-client-connection-ip',
  'x-vercel-forwarded-for',
  'x-azure-clientip',
  'x-appengine-user-ip',
  'x-cluster-client-ip',
  'x-real-ip',
  'x-client-ip',
  'x-real-client-ip',
  'x-forwarded-client-ip',
  'x-original-forwarded-for',
  'x-forwarded-for',
  'x-forwarded',
  'forwarded-for',
  'forwarded'
])

// 未配置 TRUSTED_CLIENT_IP_HEADERS 时的回退头部列表，覆盖主流平台
const FALLBACK_CLIENT_IP_HEADERS = Object.freeze([
  'x-forwarded-for',
  'x-real-ip',
  'x-vercel-forwarded-for',
  'cf-connecting-ip',
  'true-client-ip'
])

function getTrustedClientIPHeaders() {
  const configured = String(process.env.TRUSTED_CLIENT_IP_HEADERS || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter((header) => SUPPORTED_CLIENT_IP_HEADERS.has(header))

  return configured.length > 0
    ? [...new Set(configured)]
    : FALLBACK_CLIENT_IP_HEADERS
}

/**
 * 获取客户端IP地址
 * @param event H3Event对象
 * @returns 客户端IP地址
 */
export function getClientIP(event: H3Event): string {
  const headers = getHeaders(event)

  // 只有部署者明确声明受信头部时才读取转发头，避免客户端直连源站时伪造 IP。
  const ipHeaders = getTrustedClientIPHeaders()

  for (const header of ipHeaders) {
    const value = headers[header]
    if (value) {
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) {
        for (const candidate of String(item).split(',')) {
          const ip = normalizeIPCandidate(candidate)
          if (ip) return ip
        }
      }
    }
  }

  // 如果没有找到，直接从连接信息获取

  // 从连接信息获取IP（备用方法）
  const remoteAddress = event.node.req.socket?.remoteAddress
  if (remoteAddress) {
    // 移除IPv6映射的IPv4前缀
    const cleanIP = normalizeIPCandidate(remoteAddress)
    if (cleanIP) {
      return cleanIP
    }
  }

  return 'unknown'
}

function normalizeIPCandidate(value: string): string | null {
  let candidate = value.trim().replace(/^"|"$/g, '')
  const forwardedMatch = candidate.match(/^for\s*=\s*(.+)$/i)
  if (forwardedMatch) {
    const forwardedValue = forwardedMatch[1] || ''
    candidate = (forwardedValue.split(';').shift() || '').trim().replace(/^"|"$/g, '')
  }

  if (candidate.startsWith('[')) {
    const closingBracket = candidate.indexOf(']')
    if (closingBracket > 0) candidate = candidate.slice(1, closingBracket)
  } else if (isIP(candidate) === 0 && /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(':'))
  }

  const cleanIP = candidate.replace(/^::ffff:/i, '')
  return isValidIP(cleanIP) ? cleanIP : null
}

/**
 * 验证IP地址格式是否有效
 * @param ip IP地址字符串
 * @returns 是否为有效IP
 */
function isValidIP(ip: string): boolean {
  // Node 原生解析器支持压缩 IPv6，避免大量合法地址被归入 unknown 共享限流桶。
  if (isIP(ip) === 0) {
    return false
  }

  // 排除明显无效的IP
  if (ip === '0.0.0.0' || ip === '::') {
    return false
  }

  return true
}

/**
 * 格式化IP地址用于邮件显示
 * @param ip IP地址
 * @returns 格式化后的IP地址字符串
 */
export function formatIPForEmail(ip: string): string {
  if (!ip || ip === 'unknown') {
    return '未知'
  }

  // 如果是本地IP，显示为本地访问
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return `${ip} (本地网络)`
  }

  return ip
}
