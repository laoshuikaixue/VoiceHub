/**
 * 网易云接口的 X-Real-IP 出口伪装。
 *
 * 背景：网易云按请求来源 IP 判定地区。部署在境外或云函数 / CDN 边缘节点上的
 * 实例，直连网易云时出口 IP 会被识别为海外，扫码登录会被判定为海外请求并返回
 * 失败（登录态校验、账号歌单同理）。上游 SDK 支持通过 `realIP` 参数写入
 * `X-Real-IP` / `X-Forwarded-For`，这里统一注入一个中国大陆住宅宽带随机公网 IP，
 * 让网易云把请求当作国内用户。
 *
 * 稳定性约束：同一次扫码（同一个访客）与同一个账号（同一份 MUSIC_U）必须落在
 * 同一个 IP 上，否则登录态会在多个地区间反复跳变，触发风控。因此带种子时用
 * 确定性哈希选 IP，不带种子时才用随机数。
 */

import { NETEASE_REAL_IP_CIDRS } from '~~/server/config/constants'

interface ChinaIpRange {
  start: number
  end: number
  note: string
}

const ipv4ToInt = (ip: string): number => {
  const parts = ip.split('.')
  if (parts.length !== 4) return -1
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return -1
    const octet = Number(part)
    if (octet < 0 || octet > 255) return -1
    value = (value << 8) | octet
  }
  return value >>> 0
}

const intToIpv4 = (value: number): string =>
  [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff).join('.')

/** CIDR 转闭区间；非法配置直接丢弃，避免一条手误拖垮整个接口 */
const cidrToRange = (cidr: string, note: string): ChinaIpRange | null => {
  const [base, bitsRaw] = cidr.split('/')
  const bits = Number(bitsRaw)
  const baseInt = ipv4ToInt(base || '')
  if (baseInt < 0 || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    console.warn(`[netease-real-ip] 忽略非法网段配置: ${cidr}`)
    return null
  }
  const size = 2 ** (32 - bits)
  const start = baseInt
  const end = Math.min(start + size - 1, 0xffffffff)
  return { start, end, note }
}

const RANGES: ChinaIpRange[] = NETEASE_REAL_IP_CIDRS.map(([cidr, note]) =>
  cidrToRange(cidr, note)
).filter((range): range is ChinaIpRange => range !== null)

const TOTAL_ADDRESSES = RANGES.reduce((sum, range) => sum + (range.end - range.start + 1), 0)

/** FNV-1a 32 位哈希，用于把扫码 seed / 账号 cookie 稳定映射到固定 IP */
const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

const randomOffset = (): number => {
  // 不使用 Math.random：出口 IP 属于风控相关参数，用 CSPRNG 避免可预测。
  // 直接取模会让低位地址略占优，这里用拒绝采样消除模偏差。
  const buffer = new Uint32Array(1)
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % TOTAL_ADDRESSES)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    globalThis.crypto.getRandomValues(buffer)
    if (buffer[0] < limit) return buffer[0] % TOTAL_ADDRESSES
  }
  return buffer[0] % TOTAL_ADDRESSES
}

const offsetForSeed = (seed: string): number => {
  const primary = fnv1a(seed)
  const secondary = fnv1a(`voicehub:${seed}`)
  return (primary * 0x10000 + secondary) % TOTAL_ADDRESSES
}

/** 在中国大陆网段池中取一个 IP；带种子时同一 seed 恒定返回同一 IP */
export const pickChinaIp = (seed?: string): string => {
  if (RANGES.length === 0 || TOTAL_ADDRESSES <= 0) {
    // 理论上不会发生（网段为常量），兜底返回一个常见住宅段内的地址
    return '113.108.0.1'
  }

  const normalizedSeed = typeof seed === 'string' ? seed.trim() : ''
  let offset = normalizedSeed ? offsetForSeed(normalizedSeed) : randomOffset()

  let chosen = RANGES[RANGES.length - 1]!
  for (const range of RANGES) {
    const span = range.end - range.start + 1
    if (offset < span) {
      chosen = range
      break
    }
    offset -= span
  }

  let value = chosen.start + offset
  const lastOctet = value & 0xff
  if (lastOctet === 0) value += 1
  else if (lastOctet === 255) value -= 1
  return intToIpv4(value)
}

/** 判断 IP 是否落在中国大陆网段池内（配置自检与测试用） */
export const isChinaIp = (ip: string): boolean => {
  const value = ipv4ToInt(ip)
  if (value < 0) return false
  return RANGES.some((range) => value >= range.start && value <= range.end)
}

/** 是否启用出口 IP 伪装（NETEASE_REAL_IP_MODE=off 可整体关停） */
export const isNeteaseRealIpEnabled = (): boolean =>
  String(process.env.NETEASE_REAL_IP_MODE || 'cn').trim().toLowerCase() !== 'off'

/**
 * 解析本次请求应使用的 realIP：
 * 1. NETEASE_REAL_IP 指定固定 IP 时优先使用（排障用）；
 * 2. 否则按种子（扫码访客 IP / 账号 MUSIC_U）稳定选一个中国大陆住宅 IP。
 */
export const resolveNeteaseRealIp = (seed?: string): string => {
  const fixed = String(process.env.NETEASE_REAL_IP || '').trim()
  if (fixed && ipv4ToInt(fixed) >= 0) return fixed
  return pickChinaIp(seed)
}
