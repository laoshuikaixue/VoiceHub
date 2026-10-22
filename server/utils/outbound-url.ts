import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { publicAddress } from '~~/server/utils/music-source-plugins/network'

/**
 * 出站目标 URL 校验（用于管理员可配置的外部存储目标：WebDAV / S3）
 *
 * 背景：WebDAV url 与 S3 endpoint 由超级管理员在后台填写，服务端会向该地址发起请求
 * （含 MKCOL / PUT / DELETE 等方法）。若不做校验，管理员（或被盗用的管理员账号）
 * 可把备份目标指向云厂商元数据服务（如 169.254.169.254）或内网管理接口，
 * 借服务端身份窃取云凭据、探测内网，属于 SSRF。
 *
 * 策略：
 * 1. 仅允许 http / https 协议（拒绝 file://、gopher:// 等）；
 * 2. 拒绝 URL 内嵌用户名密码（避免凭据泄漏到日志/异常信息）；
 * 3. 硬性拒绝云厂商元数据端点与常见内部管理域名——这类地址在任何部署形态下
 *    都不可能是合法的备份存储目标；
 * 4. 私网地址默认放行（校园网内的 NAS / 私有化 S3 是常见且合理的部署形态），
 *    但可通过环境变量 BACKUP_BLOCK_PRIVATE_NETWORK=true 收紧为仅允许公网地址。
 */

/** 云厂商元数据端点：任何场景下都不允许作为备份目标 */
const BLOCKED_METADATA_ADDRESSES = new Set([
  '169.254.169.254', // AWS / Azure / GCP / OpenStack 统一元数据地址
  '169.254.170.2', // AWS ECS Task Metadata
  '100.100.100.200', // 阿里云 ECS 元数据
  'fd00:ec2::254', // AWS IPv6 元数据
  '192.0.0.192', // Oracle Cloud 元数据
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data'
])

/** 常见内部管理域名后缀 */
const BLOCKED_HOSTNAME_SUFFIXES = [
  '.internal',
  '.local',
  '.localhost',
  '.cluster.local'
]

export interface OutboundUrlValidationResult {
  valid: boolean
  reason?: string
}

const stripBrackets = (hostname: string) => hostname.replace(/^\[|\]$/g, '')

const isBlockedHostname = (hostname: string): boolean => {
  const host = stripBrackets(hostname).toLowerCase().replace(/\.$/, '')
  if (!host) return true
  if (BLOCKED_METADATA_ADDRESSES.has(host)) return true
  if (host === 'localhost') return true
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/**
 * 校验出站目标 URL
 * @param rawUrl 待校验的 URL
 * @param options.allowPrivateNetwork 是否允许私网地址（默认允许）
 */
export async function validateOutboundUrl(
  rawUrl: string,
  options: { allowPrivateNetwork?: boolean } = {}
): Promise<OutboundUrlValidationResult> {
  const allowPrivateNetwork = options.allowPrivateNetwork ?? !isPrivateNetworkBlockedByEnv()

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { valid: false, reason: 'URL 格式无效' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: '仅支持 http/https 协议' }
  }

  if (url.username || url.password) {
    return { valid: false, reason: 'URL 不能包含用户名或密码' }
  }

  const hostname = stripBrackets(url.hostname)
  if (isBlockedHostname(hostname)) {
    return { valid: false, reason: '不允许指向元数据服务或内部管理域名' }
  }

  // 直连 IP：直接判定
  if (isIP(hostname)) {
    if (!allowPrivateNetwork && !publicAddress(hostname)) {
      return { valid: false, reason: '不允许指向内网地址' }
    }
    return { valid: true }
  }

  // 域名：解析后逐个判定，避免绕过（DNS Rebinding 的粗筛）
  try {
    const addresses = await lookup(hostname, { all: true })
    if (!addresses.length) {
      return { valid: false, reason: '域名无法解析' }
    }
    if (!allowPrivateNetwork) {
      for (const item of addresses) {
        if (!publicAddress(item.address)) {
          return { valid: false, reason: '该域名解析到内网地址' }
        }
      }
    }
  } catch {
    return { valid: false, reason: '域名解析失败' }
  }

  return { valid: true }
}

/** 环境变量是否要求禁止私网访问 */
function isPrivateNetworkBlockedByEnv(): boolean {
  const value = String(process.env.BACKUP_BLOCK_PRIVATE_NETWORK || '').trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes'
}
