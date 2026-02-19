import { apiKeyPermissions, apiKeys, db } from '~/drizzle/db'
import { and, eq, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { ApiLogService } from '~~/server/services/apiLogService'
import {
  API_ERROR_CODES,
  API_ERROR_MESSAGES,
  API_KEY_CONSTANTS,
  HTTP_STATUS
} from '~~/server/config/constants'
import { openApiCache } from '~~/server/utils/open-api-cache'
import { getBeijingTime } from '~/utils/timeUtils'
import { getIPBlockRemainingTime, isIPBlocked } from '~~/server/services/securityService'
import { getClientIP } from '~~/server/utils/ip-utils'

/**
 * 记录API访问日志
 */
async function logApiAccess(
  apiKeyId: number,
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
      responseBody: responseBody ? openApiCache.truncateResponseBody(responseBody) : undefined,
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

  console.log(`[API Auth Middleware] 处理请求: ${pathname}`)

  // 只处理开放API路由 (/api/open/*)
  if (!pathname.startsWith('/api/open/')) {
    return
  }

  console.log(`[API Auth Middleware] 开始处理开放API请求: ${pathname}`)

  const startTime = Date.now()
  const method = getMethod(event)
  const userAgent = getHeader(event, 'user-agent') || ''

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

  console.log(
    `[API Auth Middleware] 获取到的API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'null'}`
  )

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
    console.log(
      `[API Auth Middleware] 验证API Key格式: 长度=${apiKey.length}, 前缀=${apiKey.startsWith('vhub_')}`
    )

    if (
      !apiKey.startsWith(API_KEY_CONSTANTS.PREFIX) ||
      apiKey.length !== API_KEY_CONSTANTS.TOTAL_LENGTH
    ) {
      console.log(`[API Auth Middleware] API Key格式无效`)
      throw new Error(API_ERROR_MESSAGES[API_ERROR_CODES.INVALID_API_KEY_FORMAT])
    }

    // 提取前缀和哈希API Key
    const keyPrefix = apiKey.substring(0, API_KEY_CONSTANTS.PREFIX_LENGTH)
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    console.log(`[API Auth Middleware] 查询API Key哈希: ${keyHash.substring(0, 10)}...`)

    // 查询API Key信息
    const apiKeyResult = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        usageCount: apiKeys.usageCount
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.keyPrefix, keyPrefix)))
      .limit(1)

    console.log(
      `[API Auth Middleware] 数据库查询结果: ${apiKeyResult.length > 0 ? '找到记录' : '未找到记录'}`
    )

    const apiKeyRecord = apiKeyResult[0]

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

    console.log(
      `[API Auth Middleware] API Key记录: ID=${apiKeyRecord.id}, 名称=${apiKeyRecord.name}, 过期时间=${apiKeyRecord.expiresAt}`
    )

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
      console.log(`[API Auth Middleware] API Key已过期`)
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
    console.log(`[API Auth Middleware] 开始原子更新API Key使用统计`)
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: sql`${apiKeys.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(apiKeys.id, apiKeyRecord.id))
    console.log(`[API Auth Middleware] API Key使用统计原子更新完成`)

    // 记录成功的API访问
    console.log(`[API Auth Middleware] 开始记录API访问日志`)
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
      console.log(`[API Auth Middleware] API访问日志记录完成`)
    } catch (error) {
      console.error(`[API Auth Middleware] 记录API访问日志失败:`, error)
    }

    console.log(`[API Auth Middleware] 验证成功，继续处理请求`)

    // 将API Key信息添加到事件上下文中，供后续处理使用
    event.context.apiKey = apiKeyRecord

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
  if (pathname.startsWith('/api/open/schedules')) {
    return 'schedules:read'
  }

  if (pathname.startsWith('/api/open/songs')) {
    return 'songs:read'
  }

  return null
}
