import type { H3Event } from 'h3'
import { getRequestHeaders, getRequestURL } from 'h3'

/**
 * 安全地获取请求的协议（http 或 https）
 * 正确处理 x-forwarded-proto 可能包含多个值的情况
 * @param event H3Event
 * @returns 'http' | 'https'
 */
export function getSafeRequestProtocol(event: H3Event): 'http' | 'https' {
  const headers = getRequestHeaders(event)
  const forwardedProto = (headers['x-forwarded-proto'] || '').toString()
  const requestProto = getRequestURL(event).protocol.replace(/:$/, '').toLowerCase()
  
  const normalizedForwardedProto = forwardedProto
    ? forwardedProto.split(',')[0].trim().toLowerCase().replace(/:$/, '')
    : ''
    
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

/**
 * 获取请求的 Origin (包含协议和主机名)
 * @param event H3Event
 * @returns string 例如: https://example.com
 */
export function getRequestOrigin(event: H3Event): string {
  const protocol = getSafeRequestProtocol(event)
  const headers = getRequestHeaders(event)
  const host = headers['host'] || getRequestURL(event).host
  return `${protocol}://${host}`
}
