import type { H3Event } from 'h3'
import { getHeaders } from 'h3'
import { isIP } from 'node:net'

/**
 * 获取客户端IP地址
 * @param event H3Event对象
 * @returns 客户端IP地址
 */
export function getClientIP(event: H3Event): string {
  // 尝试从各种可能的头部获取真实IP
  const headers = getHeaders(event)

  // 按优先级检查各种IP头部
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ]

  for (const header of ipHeaders) {
    const value = headers[header]
    if (value) {
      // x-forwarded-for 可能包含多个IP，取第一个
      const ip = Array.isArray(value) ? value[0] : value
      const firstIP = ip.split(',')[0].trim()
      if (firstIP && isValidIP(firstIP)) {
        return firstIP
      }
    }
  }

  // 如果没有找到，直接从连接信息获取

  // 从连接信息获取IP（备用方法）
  const remoteAddress = event.node.req.socket?.remoteAddress
  if (remoteAddress) {
    // 移除IPv6映射的IPv4前缀
    const cleanIP = remoteAddress.replace(/^::ffff:/, '')
    if (isValidIP(cleanIP)) {
      return cleanIP
    }
  }

  return 'unknown'
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
