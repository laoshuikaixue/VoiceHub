import type { H3Event } from 'h3'
import { getRequestHeader, getRequestURL, send, setResponseHeaders, setResponseStatus } from 'h3'

/**
 * 全局错误处理器：避免内部错误信息泄露到客户端。
 *
 * 背景：nitro 2.x 的错误处理链为 [handler, ...]，通过 nuxt.config.ts 的
 * nitro:init 钩子把本处理器 unshift 到链首，链变为：
 *   [本处理器, Nuxt 错误页处理器, nitro 默认处理器]
 * 每个处理器签名为 (error, event, { defaultHandler })；发送响应后
 * event.handled 为 true，链中止；直接 return 则交给链上下一个处理器。
 *
 * 泄露根因：h3 v1 的 createError 只对「非 Error 抛出值」标记 unhandled=true。
 * 裸 Error（例如 DNS 解析失败的 getaddrinfo ENOTFOUND）的 unhandled 为
 * falsy，nitro 默认处理器按 isSensitive = unhandled || fatal 判定为非敏感，
 * 会把 error.message 原文透传给客户端，可能暴露内网主机名、数据库主机、
 * 文件路径等基础设施信息。
 *
 * 处理规则：
 *   - 应用主动抛出的 4xx（createError 的校验/权限类错误）：保留原始 message，
 *     属于面向用户的既定 UX
 *   - 5xx、裸 Error、unhandled/fatal 错误：统一返回通用文案，
 *     完整细节（含 stack / cause）只写入服务端日志
 */

// 复刻 Nuxt nitro-server 的 isJsonRequest 判定（与链上错误页处理器保持一致）
function hasReqHeader(event: H3Event, name: string, includes: string): boolean {
  const value = getRequestHeader(event, name)
  return !!(value && typeof value === 'string' && value.toLowerCase().includes(includes))
}

function isJsonRequest(event: H3Event): boolean {
  // 客户端明确要 HTML 时不按 JSON 处理
  if (hasReqHeader(event, 'accept', 'text/html')) {
    return false
  }
  return (
    hasReqHeader(event, 'accept', 'application/json') ||
    hasReqHeader(event, 'user-agent', 'curl/') ||
    hasReqHeader(event, 'user-agent', 'httpie/') ||
    hasReqHeader(event, 'sec-fetch-mode', 'cors') ||
    event.path.startsWith('/api/') ||
    event.path.endsWith('.json')
  )
}

// 应用主动抛出的 4xx 业务错误保留文案；5xx 与裸错误一律脱敏
function shouldPreserveMessage(error: any): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  if (error.unhandled || error.fatal) {
    return false
  }
  const statusCode = error.statusCode || 500
  return statusCode >= 400 && statusCode < 500
}

const GENERIC_MESSAGE = '服务暂时不可用，请稍后重试'

// 完整错误细节（含 stack / cause 链）只写服务端日志，不透传客户端
function logServerError(error: any, event: H3Event): void {
  try {
    console.error('[server-error]', {
      url: getRequestURL(event).href,
      method: event.method,
      statusCode: error?.statusCode,
      message: error?.message,
      cause: error?.cause instanceof Error ? error.cause.message : undefined,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    })
  } catch {
    // 日志本身失败不能影响错误响应
  }
}

export default async function errorHandler(
  error: any,
  event: H3Event,
  { defaultHandler }: { defaultHandler: (error: any, event: H3Event, opts?: { silent?: boolean }) => Promise<any> | any }
) {
  if (event.handled) {
    return
  }

  // 开发环境：完整错误详情交给 Nuxt 开发错误页，不脱敏
  if (import.meta.dev) {
    return
  }

  try {
    if (isJsonRequest(event)) {
      // JSON 请求：复用 nitro 默认处理器构造响应体（保证与默认行为同形、
      // 前端兼容），仅替换 message / 清空 data。silent:true 关掉默认处理器
      // 的重复日志，由 logServerError 输出结构化详情。
      const res = await defaultHandler(error, event, { silent: true })

      // 404 + baseURL 不匹配时 defaultHandler 返回 302 重定向（body 为字符串），原样放行
      if (typeof res.body === 'string') {
        setResponseHeaders(event, res.headers)
        setResponseStatus(event, res.status, res.statusText)
        return send(event, res.body)
      }

      if (!shouldPreserveMessage(error)) {
        logServerError(error, event)
        res.body.message = GENERIC_MESSAGE
        res.body.data = undefined
      }

      setResponseHeaders(event, res.headers)
      setResponseStatus(event, res.status, res.statusText)
      return send(event, JSON.stringify(res.body, null, 2))
    }

    // HTML 请求：交还链上的 Nuxt 错误页处理器渲染错误页。
    // 非应用 4xx 先标记 unhandled=true：错误页与后续默认处理器都会按敏感
    // 错误处理（统一显示 "Server Error"、不下发 data），SSR 错误页同样不泄露细节。
    if (!shouldPreserveMessage(error)) {
      error.unhandled = true
    }
  } catch (handlerError) {
    // 本处理器自身异常时保底：标记 unhandled 后交还链上处理器，
    // 此时 nitro 默认处理器 isSensitive 为 true，同样只输出 "Server Error"。
    console.error('[server-error] handler failed:', handlerError)
    try {
      error.unhandled = true
    } catch {
      // error 可能是冻结对象，忽略
    }
  }
}
