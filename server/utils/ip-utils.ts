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

function getPlatformClientIPHeaders(): string[] {
  if (process.env.VERCEL) return ['x-vercel-forwarded-for']
  if (process.env.NETLIFY) return ['x-nf-client-connection-ip']
  if (process.env.EDGEONE || String(process.env.NITRO_PRESET || '').includes('edgeone')) {
    return ['eo-connecting-ip']
  }
  return []
}

/**
 * 可信客户端 IP 头部白名单。
 *
 * 安全说明：通用转发头（x-forwarded-for 等）可被客户端伪造，仅当部署者
 * 显式通过 TRUSTED_CLIENT_IP_HEADERS 声明「自己确实位于该 CDN / 反向代理之后」，
 * 或运行在会强制覆盖自身注入头的云平台（Vercel/Netlify/EdgeOne）时才可读取。
 * 其余场景一律只使用 TCP 连接地址。
 */
function getTrustedClientIPHeaders(): string[] {
  const configured = String(process.env.TRUSTED_CLIENT_IP_HEADERS || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter((header) => SUPPORTED_CLIENT_IP_HEADERS.has(header))

  // 云平台会强制覆盖自身注入的转发头（客户端无法伪造），可直接信任
  const platformHeaders = getPlatformClientIPHeaders()
  if (platformHeaders.length > 0) {
    return platformHeaders
  }

  // 安全说明：不回退到 x-forwarded-for / x-real-ip 等通用转发头。
  // Docker/K8s 场景下反向代理与源站同处内网，「内网即可信」判定不成立：
  // X-Forwarded-For 的首个候选始终由客户端控制，回退会让攻击者伪造 IP
  // 绕过登录失败封禁、注册限流、验证码冷却等所有基于 IP 的安全控制。
  // 自建反代的部署者请显式配置 TRUSTED_CLIENT_IP_HEADERS（如 x-real-ip）。
  return []
}

function getRemoteAddress(event: H3Event): string | null {
  const raw = event.node.req.socket?.remoteAddress
  return raw ? normalizeIPCandidate(raw) : null
}

/**
 * 获取客户端IP地址
 * @param event H3Event对象
 * @returns 客户端IP地址
 */
export function getClientIP(event: H3Event): string {
  const headers = getHeaders(event)
  const remoteAddress = getRemoteAddress(event)

  // 只有部署者明确声明受信头部、或运行在会覆盖注入头的云平台时才读取转发头，
  // 避免客户端直连或经内网代理时伪造 IP 绕过封禁与限流。
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
