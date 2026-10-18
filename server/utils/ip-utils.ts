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

// 未配置 TRUSTED_CLIENT_IP_HEADERS 时，仅在前置代理与源站同机/内网时回退到通用转发头
const PROXY_FALLBACK_CLIENT_IP_HEADERS = Object.freeze([
  'x-forwarded-for',
  'x-real-ip'
])

function getPlatformClientIPHeaders(): string[] {
  if (process.env.VERCEL) return ['x-vercel-forwarded-for']
  if (process.env.NETLIFY) return ['x-nf-client-connection-ip']
  if (process.env.EDGEONE || String(process.env.NITRO_PRESET || '').includes('edgeone')) {
    return ['eo-connecting-ip']
  }
  return []
}

function getTrustedClientIPHeaders(remoteAddress: string | null) {
  const configured = String(process.env.TRUSTED_CLIENT_IP_HEADERS || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter((header) => SUPPORTED_CLIENT_IP_HEADERS.has(header))

  if (configured.length > 0) {
    return [...new Set(configured)]
  }

  // 云平台会覆盖自身注入的转发头，可直接信任
  const platformHeaders = getPlatformClientIPHeaders()
  if (platformHeaders.length > 0) {
    return platformHeaders
  }

  // 公网直连源站时忽略转发头，防止客户端伪造 IP 绕过封禁与限流；
  // 前置反向代理与源站同机或内网时仍按通用头解析，兼容自建反代。
  return remoteAddress && isPrivateOrLoopbackAddress(remoteAddress)
    ? [...PROXY_FALLBACK_CLIENT_IP_HEADERS]
    : []
}

function getRemoteAddress(event: H3Event): string | null {
  const raw = event.node.req.socket?.remoteAddress
  return raw ? normalizeIPCandidate(raw) : null
}

function isPrivateOrLoopbackAddress(ip: string): boolean {
  if (ip === '::1') return true
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  ) {
    return true
  }

  const ipv4 = ip.match(/^172\.(\d{1,2})\./)
  if (ipv4) {
    const second = Number(ipv4[1])
    if (second >= 16 && second <= 31) return true
  }

  const lower = ip.toLowerCase()
  return (
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  )
}

/**
 * 获取客户端IP地址
 * @param event H3Event对象
 * @returns 客户端IP地址
 */
export function getClientIP(event: H3Event): string {
  const headers = getHeaders(event)
  const remoteAddress = getRemoteAddress(event)

  // 只有部署者明确声明受信头部、平台环境或内网反代场景才读取转发头，
  // 避免客户端直连源站时伪造 IP 绕过封禁与限流。
  const ipHeaders = getTrustedClientIPHeaders(remoteAddress)

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
  if (remoteAddress) {
    return remoteAddress
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
