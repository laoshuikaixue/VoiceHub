import { db, apiKeys, apiKeyPermissions } from '~/drizzle/db'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import { ApiLogService } from '~/server/services/apiLogService'

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
  const getClientIP = (event: any): string => {
    const xForwardedFor = event.node.req.headers['x-forwarded-for'] as string
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim()
    }
    return event.node.req.socket.remoteAddress || 'unknown'
  }
  
  const ipAddress = getClientIP(event)

  // 获取API Key
  const apiKey = getHeader(event, 'x-api-key')
  
  console.log(`[API Auth Middleware] 获取到的API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'null'}`)
  
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
    
    return sendError(event, createError({
      statusCode: 401,
      message: 'API Key is required. Please provide a valid API Key in the X-API-Key header.'
    }))
  }

  try {
    // 验证API Key格式 (应该是 vhub_xxxxxxxxxxxxxxxx 格式)
    console.log(`[API Auth Middleware] 验证API Key格式: 长度=${apiKey.length}, 前缀=${apiKey.startsWith('vhub_')}`)
    
    if (!apiKey.startsWith('vhub_') || apiKey.length !== 37) {
      console.log(`[API Auth Middleware] API Key格式无效`)
      throw new Error('Invalid API Key format')
    }

    // 提取前缀和哈希API Key
    const keyPrefix = apiKey.substring(0, 10) // vhub_xxxxx
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
    
    console.log(`[API Auth Middleware] 查询API Key哈希: ${keyHash.substring(0, 10)}...`)

    // 查询API Key信息
    const apiKeyResult = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      isActive: apiKeys.isActive,
      expiresAt: apiKeys.expiresAt,
      usageCount: apiKeys.usageCount
    })
    .from(apiKeys)
    .where(and(
      eq(apiKeys.keyHash, keyHash),
      eq(apiKeys.keyPrefix, keyPrefix)
    ))
    .limit(1)
    
    console.log(`[API Auth Middleware] 数据库查询结果: ${apiKeyResult.length > 0 ? '找到记录' : '未找到记录'}`)

    const apiKeyRecord = apiKeyResult[0]
    
    if (!apiKeyRecord) {
      console.log(`[API Auth Middleware] API Key未找到或未激活`)
      await ApiLogService.logAccess({
        apiKeyId: null,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: 401,
        responseTimeMs: Date.now() - startTime,
        errorMessage: 'Invalid API Key'
      })
      
      throw new Error('Invalid API Key')
    }

    console.log(`[API Auth Middleware] API Key记录: ID=${apiKeyRecord.id}, 名称=${apiKeyRecord.name}, 过期时间=${apiKeyRecord.expiresAt}`)

    // 检查API Key是否激活
    if (!apiKeyRecord.isActive) {
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: 403,
        responseTimeMs: Date.now() - startTime,
        errorMessage: 'API Key is disabled'
      })
      
      throw new Error('API Key is disabled')
    }

    // 检查API Key是否过期
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      console.log(`[API Auth Middleware] API Key已过期`)
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode: 403,
        responseTimeMs: Date.now() - startTime,
        errorMessage: 'API Key has expired'
      })
      
      throw new Error('API Key has expired')
    }



    // 检查权限
    const requiredPermission = getRequiredPermission(pathname, method)
    console.log(`[API Auth Middleware] 所需权限: ${requiredPermission}`)
    
    if (requiredPermission) {
      const permissionResult = await db.select()
        .from(apiKeyPermissions)
        .where(and(
          eq(apiKeyPermissions.apiKeyId, apiKeyRecord.id),
          eq(apiKeyPermissions.permission, requiredPermission)
        ))
        .limit(1)

      console.log(`[API Auth Middleware] 权限检查结果: ${permissionResult.length > 0 ? '通过' : '失败'}`)

      if (permissionResult.length === 0) {
        console.log(`[API Auth Middleware] 缺少必需权限: ${requiredPermission}`)
        await ApiLogService.logAccess({
          apiKeyId: apiKeyRecord.id,
          endpoint: pathname,
          method,
          ipAddress,
          userAgent,
          statusCode: 403,
          responseTimeMs: Date.now() - startTime,
          errorMessage: `Missing required permission: ${requiredPermission}`
        })
        
        throw new Error(`Insufficient permissions. Required: ${requiredPermission}`)
      }
    }

    // 更新API Key使用统计
    console.log(`[API Auth Middleware] 开始更新API Key使用统计`)
    await db.update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: apiKeyRecord.usageCount + 1,
        updatedAt: new Date()
      })
      .where(eq(apiKeys.id, apiKeyRecord.id))
    console.log(`[API Auth Middleware] API Key使用统计更新完成`)

    // 记录API访问日志
    console.log(`[API Auth Middleware] 开始记录API访问日志`)
    try {
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
        userAgent: getHeader(event, 'user-agent') || 'Unknown',
        ipAddress
      })
      console.log(`[API Auth Middleware] API访问日志记录完成`)
    } catch (logError) {
      console.error(`[API Auth Middleware] API访问日志记录失败:`, logError)
    }

    console.log(`[API Auth Middleware] 验证成功，继续处理请求`)

    // 将API Key信息添加到事件上下文中，供后续处理使用
    event.context.apiKey = apiKeyRecord
    
    // 记录成功的API访问（在响应后记录）
    event.context.logApiAccess = async (statusCode: number, responseBody?: string, errorMessage?: string) => {
      await ApiLogService.logAccess({
        apiKeyId: apiKeyRecord.id,
        endpoint: pathname,
        method,
        ipAddress,
        userAgent,
        statusCode,
        responseTimeMs: Date.now() - startTime,
        requestBody: method !== 'GET' ? await readBody(event).catch(() => null) : null,
        responseBody: responseBody ? JSON.stringify(responseBody).substring(0, 10000) : null, // 限制响应体大小
        errorMessage
      })
    }
    
    // 验证成功，让请求继续到API端点
    return

  } catch (error: any) {
    return sendError(event, createError({
      statusCode: error.message.includes('expired') || error.message.includes('disabled') || error.message.includes('permissions') || error.message.includes('IP address') ? 403 : 401,
      message: error.message
    }))
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