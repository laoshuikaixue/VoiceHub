/**
 * IP 白名单匹配（CIDR + 单 IP）
 *
 * 白名单存储在 api_keys.ip_whitelist，JSON 数组，元素可以是：
 *   - "1.2.3.4"（单 IP）
 *   - "1.2.3.0/24"（CIDR）
 *
 * 返回 true 表示允许访问。
 */

export function parseIpWhitelist(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function ipToLong(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isInteger(n) || n < 0 || n > 255) return null
    result = (result << 8) + n
  }
  return result >>> 0
}

export function isIpAllowed(clientIp: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return true // 无白名单 → 不限制
  const ipNum = ipToLong(clientIp)
  if (ipNum == null) return false

  for (const entry of whitelist) {
    const trimmed = entry.trim()
    if (!trimmed) continue

    if (trimmed.includes('/')) {
      // CIDR 段
      const [base, prefixStr] = trimmed.split('/')
      const prefix = Number(prefixStr)
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) continue
      const baseNum = ipToLong(base)
      if (baseNum == null) continue
      if (prefix === 0) return true
      const mask = prefix === 32 ? 0xffffffff : ((0xffffffff << (32 - prefix)) >>> 0)
      if ((ipNum & mask) === (baseNum & mask)) return true
    } else {
      // 单 IP
      const exact = ipToLong(trimmed)
      if (exact != null && exact === ipNum) return true
    }
  }

  return false
}
