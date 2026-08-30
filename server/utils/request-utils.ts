import type { H3Event } from 'h3'
import { createError, getRequestHeaders, getRequestURL } from 'h3'

const getFirstForwardedValue = (value: string | undefined): string =>
  value?.split(',')[0]?.trim() || ''

/**
 * 安全地获取请求的协议（http 或 https）
 * 正确处理 x-forwarded-proto 可能包含多个值的情况
 * @param event H3Event
 * @returns 'http' | 'https'
 */
export function getSafeRequestProtocol(event: H3Event): 'http' | 'https' {
  const headers = getRequestHeaders(event)
  const forwardedProto = getFirstForwardedValue(headers['x-forwarded-proto']?.toString())
  const requestProto = getRequestURL(event).protocol.replace(/:$/, '').toLowerCase()

  const normalizedForwardedProto = forwardedProto.toLowerCase().replace(/:$/, '')
  // 非法的转发协议值不可信，忽略并回退到请求自身协议，避免误伤全局认证等调用方
  if (normalizedForwardedProto && !['http', 'https'].includes(normalizedForwardedProto)) {
    return requestProto === 'https' ? 'https' : 'http'
  }

  return (normalizedForwardedProto || requestProto) === 'https' ? 'https' : 'http'
}

/**
 * 判断请求是否安全（即是否为 https）
 * @param event H3Event
 * @returns boolean
 */
export function isSecureRequest(event: H3Event): boolean {
  return getSafeRequestProtocol(event) === 'https'
}

export interface OriginInfo {
  origin: string
  protocol: string
  hostname: string
  port: string
  explicitPort: string
}

export function normalizeOrigin(value: string, fallbackProtocol: string): OriginInfo {
  const normalizedValue = value.includes('://') ? value : `${fallbackProtocol}//${value}`
  const url = new URL(normalizedValue)
  const protocol = url.protocol

  return {
    origin: url.origin,
    protocol,
    hostname: url.hostname,
    port: url.port || (protocol === 'https:' ? '443' : '80'),
    explicitPort: url.port
  }
}

export function isTrustedOrigin(source: OriginInfo, trusted: OriginInfo): boolean {
  // 反代未透传外部协议时，允许同主机 HTTPS 访问按 HTTP 配置的来源
  return (
    source.hostname === trusted.hostname &&
    source.explicitPort === trusted.explicitPort &&
    (source.protocol === trusted.protocol ||
      (source.protocol === 'https:' && trusted.protocol === 'http:'))
  )
}

// 不带方括号的裸 IPv6 地址需补齐方括号才能通过 URL 解析
const normalizeHostForUrl = (host: string): string =>
  host.includes(':') && !host.startsWith('[') && /^[0-9a-f:]+$/i.test(host) ? `[${host}]` : host

/**
 * 获取请求的 Origin (包含协议和主机名)
 * @param event H3Event
 * @returns string 例如: https://example.com
 */
export function getRequestOrigin(event: H3Event): string {
  const protocol = getSafeRequestProtocol(event)
  const headers = getRequestHeaders(event)
  const forwardedHost = getFirstForwardedValue(headers['x-forwarded-host']?.toString())
  const host = forwardedHost || headers['host']?.toString() || getRequestURL(event).host

  try {
    const requestUrl = new URL(`${protocol}://${normalizeHostForUrl(host)}`)
    if (
      requestUrl.origin === 'null' ||
      requestUrl.username ||
      requestUrl.password ||
      requestUrl.pathname !== '/' ||
      requestUrl.search ||
      requestUrl.hash
    ) {
      throw new Error('invalid host')
    }
    return requestUrl.origin
  } catch {
    throw createError({ statusCode: 400, message: '请求 Host 无效' })
  }
}
