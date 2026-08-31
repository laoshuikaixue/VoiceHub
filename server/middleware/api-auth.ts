import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { and, eq, sql } from 'drizzle-orm'
import { ApiLogService } from '~~/server/services/apiLogService'
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  API_KEY_CONSTANTS,
  HTTP_STATUS
} from '~~/server/config/constants'
import { getBeijingTime } from '~/utils/timeUtils'
import { getIPBlockRemainingTime, isIPBlocked } from '~~/server/services/securityService'
import { getClientIP } from '~~/server/utils/ip-utils'
import { verifyApiKey } from '~~/server/utils/apiKeyUtils'
import { checkAndIncrementRate, type RateCheckResult } from '~~/server/utils/ratelimit/pg'
import { sendWebhookWithRetry, type WebhookPayload } from '~~/server/utils/webhook'
import { isIpAllowed, parseIpWhitelist } from '~~/server/utils/ip-whitelist'

const truncateResponseBody = (responseBody: any, maxLength = 10000) => {
  try {
    const json = JSON.stringify(responseBody)
    return json.length <= maxLength ? json : `${json.slice(0, maxLength)}...`
  } catch {
    return String(responseBody).slice(0, maxLength)
  }
}

/**
 * 记录API访问日志
 */
async function logApiAccess(
  apiKeyId: string,
  method: string,
  endpoint: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress: string,
  userAgent: string,
  requestBody?: string,
  responseBody?: any,
  errorMessage?: string
) {
  try {
    // 写入数据库日志
    await ApiLogService.logAccess({
      apiKeyId,
      endpoint,
      method,
      ipAddress,
      userAgent,
      statusCode,
      responseTimeMs,
      requestBody,
      responseBody: responseBody ? truncateResponseBody(responseBody) : undefined,
      errorMessage
    })
  } catch (error) {
    console.error('[API Auth Middleware] 记录API访问日志失败:', error)
  }
}

/**
 * API Key认证中间件
 * 处理开放API的认证和权限验证
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // 只处理开放API路由 (/api/open/*)
  if (!pathname.startsWith('/api/open/')) {
    return
  }

  const startTime = Date.now()
  const method = getMethod(event)
  const userAgent = getHeader(event, 'user-agent') || ''
  console.log(`[API Auth Middleware] 开始处理开放API请求: ${method} ${pathname}`)

  // 获取客户端真实IP地址
  const ipAddress = getClientIP(event)

  // 检查IP是否被限制
  if (isIPBlocked(ipAddress)) {
    const remainingTime = getIPBlockRemainingTime(ipAddress)
    await ApiLogService.logAccess({
      apiKeyId: null,
      endpoint: pathname,
      method,
      ipAddress,
      userAgent,
      statusCode: 423,
      responseTimeMs: Date.now() - startTime,
      errorMessage: `IP地址已被限制访问，剩余时间: ${remainingTime}分钟`
    })

    return sendError(
      event,
      createError({
        statusCode: 423,
        message: `您的IP地址已被限制访问，请在 ${remainingTime} 分钟后重试`
      })
    )
  }

  // 获取API Key
  const apiKey = getHeader(event, 'x-api-key')

  console.log('[API Auth Middleware] 已收到开放API Key，开始校验')

  if (!apiKey) {
    console.log(`[API Auth Middleware] API Key缺失`)
    await ApiLogService.logAccess({
      apiKeyId: null,
      endpoint: pathname,
      method,
      ipAddress,
      userAgent,
      statusCode: 401,
      responseTimeMs: Date.now() - startTime
    })

    return sendError(
      event,
      createError({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: API_ERROR_MESSAGES[API_ERROR_CODES.MISSING_API_KEY]
      })
    )
  }

  try {
    // 验证API Key格式 (应该是 vhub_xxxxxxxxxxxxxxxx 格式)
    console.log('[API Auth Middleware] 验证API Key格式')

    if (
      !apiKey.startsWith(API_KEY_CONSTANTS.PREFIX) ||
      apiKey.length !== API_KEY_CONSTANTS.TOTAL_LENGTH
    ) {
      console.log(`[API Auth Middleware] API Key格式无效`)
      throw new Error(API_ERROR_MESSAGES[API_ERROR_CODES.INVALID_API_KEY_FORMAT])
    }

    // 提取前缀用于候选匹配，不输出任何明文片段
    const keyPrefix = apiKey.substring(0, API_KEY_CONSTANTS.PREFIX_LENGTH)
    console.log('[API Auth Middleware] 开始按前缀匹配API Key候选')

    // 查询API Key信息
    const apiKeyResult = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyHash: apiKeys.keyHash,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        usageCount: apiKeys.usageCount,
        createdByUserId: apiKeys.createdByUserId,
        rateLimitPerMinute: apiKeys.rateLimitPerMinute,
        quotaDaily: apiKeys.quotaDaily,
        quotaMonthly: apiKeys.quotaMonthly,
        ipWhitelist: apiKeys.ipWhitelist,
        webhookUrl: apiKeys.webhookUrl
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))

    console.log(
      `[API Auth Middleware] 数据库查询结果: ${apiKeyResult.length > 0 ? '找到记录' : '未找到记录'}`
    )

    const apiKeyRecord = await findValidApiKeyRecord(apiKey, apiKeyResult)

    if (!apiKeyRecord) {
      console.log(`[API Auth Middleware] API Key未找到或未激活`)
      await ApiLogService.logAccess({
        apiKeyId: null,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        responseTimeMs: Date.now() - startTime,
        errorMessage: API_ERROR_MESSAGES[API_ERROR_CODES.INVALID_API_KEY]
      })

      throw new Error(API_ERROR_MESSAGES[API_ERROR_CODES.INVALID_API_KEY])
    }

    console.log('[API Auth Middleware] API Key验证通过')

    // 检查API Key是否激活
    if (!apiKeyRecord.isActive) {
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: HTTP_STATUS.FORBIDDEN,
        responseTimeMs: Date.now() - startTime,
        errorMessage: API_ERROR_MESSAGES[API_ERROR_CODES.API_KEY_DISABLED]
      })

      throw new Error(API_ERROR_MESSAGES[API_ERROR_CODES.API_KEY_DISABLED])
    }

    // 检查API Key是否过期
    if (apiKeyRecord.expiresAt && getBeijingTime() > apiKeyRecord.expiresAt) {
      console.log('[API Auth Middleware] API Key已过期')
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: HTTP_STATUS.FORBIDDEN,
        responseTimeMs: Date.now() - startTime,
        errorMessage: API_ERROR_MESSAGES[API_ERROR_CODES.API_KEY_EXPIRED]
      })

      throw new Error(API_ERROR_MESSAGES[API_ERROR_CODES.API_KEY_EXPIRED])
    }

    // IP 白名单（spec [S4.3]）
    const ipWhitelist = parseIpWhitelist(apiKeyRecord.ipWhitelist)
    if (ipWhitelist.length > 0 && !isIpAllowed(ipAddress, ipWhitelist)) {
      console.log(`[API Auth Middleware] IP ${ipAddress} 不在白名单内`)
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: HTTP_STATUS.FORBIDDEN,
        responseTimeMs: Date.now() - startTime,
        errorMessage: 'IP_NOT_ALLOWED'
      })

      throw new Error('您的 IP 不在该 API Key 的白名单内')
    }

    // 速率限制 + 配额（spec [S4.3] PG 原子累加）
    const rateCheck: RateCheckResult = await checkAndIncrementRate({
      apiKeyId: apiKeyRecord.id,
      rateLimitPerMinute: apiKeyRecord.rateLimitPerMinute ?? null,
      quotaDaily: apiKeyRecord.quotaDaily ?? null,
      quotaMonthly: apiKeyRecord.quotaMonthly ?? null
    })
    if (!rateCheck.ok) {
      const reasonLabel = {
        rate_limit: 'API_KEY_RATE_LIMITED',
        quota_daily: 'API_KEY_DAILY_QUOTA_EXCEEDED',
        quota_monthly: 'API_KEY_MONTHLY_QUOTA_EXCEEDED'
      }[rateCheck.reason]
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: 429,
        responseTimeMs: Date.now() - startTime,
        errorMessage: reasonLabel
      })

      event.node.res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds))
      event.node.res.setHeader('X-RateLimit-Remaining', '0')
      return sendError(
        event,
        createError({
          statusCode: 429,
          statusMessage: reasonLabel,
          message: `${reasonLabel}: 当前 ${rateCheck.current}/${rateCheck.limit}`
        })
      )
    }

    // 检查权限
    const requiredPermission = getRequiredPermission(pathname, method)
    console.log(`[API Auth Middleware] 所需权限: ${requiredPermission}`)

    if (requiredPermission) {
      const permissionResult = await db
        .select()
        .from(apiKeyPermissions)
        .where(
          and(
            eq(apiKeyPermissions.apiKeyId, apiKeyRecord.id),
            eq(apiKeyPermissions.permission, requiredPermission)
          )
        )
        .limit(1)

      console.log(
        `[API Auth Middleware] 权限检查结果: ${permissionResult.length > 0 ? '通过' : '失败'}`
      )

      if (permissionResult.length === 0) {
        console.log(`[API Auth Middleware] 缺少必需权限: ${requiredPermission}`)
        await ApiLogService.logAccess({
          apiKeyId: apiKeyRecord.id,
          endpoint: pathname,
          method,
          ipAddress,
          userAgent,
          statusCode: HTTP_STATUS.FORBIDDEN,
          responseTimeMs: Date.now() - startTime,
          errorMessage: `${API_ERROR_MESSAGES[API_ERROR_CODES.INSUFFICIENT_PERMISSIONS]}: ${requiredPermission}`
        })

        throw new Error(
          `${API_ERROR_MESSAGES[API_ERROR_CODES.INSUFFICIENT_PERMISSIONS]}. Required: ${requiredPermission}`
        )
      }
    }

    // 使用原子操作更新API Key使用统计
    console.log('[API Auth Middleware] 开始原子更新API Key使用统计')
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: sql`${apiKeys.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(apiKeys.id, apiKeyRecord.id))
    console.log('[API Auth Middleware] API Key使用统计原子更新完成')

    // 记录成功的API访问
    console.log('[API Auth Middleware] 开始记录API访问日志')
    try {
      await logApiAccess(
        apiKeyRecord.id,
        method,
        pathname,
        HTTP_STATUS.OK,
        Date.now() - startTime,
        ipAddress,
        getHeader(event, 'user-agent') || 'Unknown'
      )
      console.log('[API Auth Middleware] API访问日志记录完成')
    } catch (error) {
      console.error(`[API Auth Middleware] 记录API访问日志失败:`, error)
    }

    console.log('[API Auth Middleware] 验证成功，继续处理请求')

    // 将API Key信息添加到事件上下文中，供后续处理使用
    event.context.apiKey = apiKeyRecord

    // Webhook 回调（spec [S4.3] + [S8]）：异步 fire-and-forget
    // 注意：webhook_secret 在 DB 中存的是 bcrypt 哈希，不可还原；
    // 此处仅在没有 secret 的情况下不发 webhook（创建时必须一次性返回明文给用户）
    if (apiKeyRecord.webhookUrl) {
      const webhookPayload: WebhookPayload = {
        event: 'api_key.request',
        payload: {
          apiKeyId: apiKeyRecord.id,
          endpoint: pathname,
          method,
          ipAddress
        }
      }
      // event.waitUntil 不需要 secret，因为我们没存明文；这里仅占位，
      // 真正的 webhook 在 ApiKeyManager 创建时已下发过 secret 给接收方；
      // 但发送回调仍需明文 secret 才能算签名，所以本期 webhook 暂时仅记录占位，
      // 等 RbacManager 提供"重置 webhook secret 明文再注入"的运维流程后启用。
      void webhookPayload
    }

    // 记录成功的API访问（在响应后记录）
    event.context.logApiAccess = async (
      statusCode: number,
      responseBody?: any,
      errorMessage?: string
    ) => {
      const requestBody = method !== 'GET' ? await readBody(event).catch(() => null) : null
      await logApiAccess(
        apiKeyRecord.id,
        method,
        pathname,
        statusCode,
        Date.now() - startTime,
        ipAddress,
        userAgent,
        requestBody ? JSON.stringify(requestBody) : undefined,
        responseBody,
        errorMessage
      )
    }

    // 验证成功，让请求继续到API端点
    return
  } catch (error: any) {
    const statusCode =
      error.message.includes('expired') ||
      error.message.includes('disabled') ||
      error.message.includes('permissions') ||
      error.message.includes('IP address')
        ? HTTP_STATUS.FORBIDDEN
        : HTTP_STATUS.UNAUTHORIZED

    return sendError(
      event,
      createError({
        statusCode,
        message: error.message
      })
    )
  }
})

/**
 * 根据路径和方法获取所需权限
 */
function getRequiredPermission(pathname: string, method: string): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/'

  if (
    normalizedPathname === '/api/open/card-codes' ||
    normalizedPathname.startsWith('/api/open/card-codes/')
  ) {
    if (
      normalizedPathname === '/api/open/card-codes/delete' ||
      normalizedPathname.startsWith('/api/open/card-codes/delete/')
    )
      return 'card-codes:delete'
    if (method === 'GET') return 'card-codes:read'
    if (method === 'DELETE') return 'card-codes:delete'
    return 'card-codes:write'
  }

  if (normalizedPathname.startsWith('/api/open/schedules')) {
    return 'schedules:read'
  }

  if (normalizedPathname.startsWith('/api/open/songs/mark-played')) {
    return 'songs:write'
  }

  if (normalizedPathname === '/api/open/songs/request' && method === 'POST') {
    return 'songs:request'
  }

  if (normalizedPathname.startsWith('/api/open/songs')) {
    return 'songs:read'
  }

  if (normalizedPathname.startsWith('/api/open/backup')) {
    return 'backup:execute'
  }

  return null
}

async function findValidApiKeyRecord(apiKey: string, records: Array<{ keyHash: string }>) {
  for (const record of records) {
    if (await verifyApiKey(apiKey, record.keyHash)) {
      return record
    }
  }

  return null
}
