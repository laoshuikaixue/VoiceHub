import { apiKeyPermissions, apiKeys, db, users } from '~/drizzle/db'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'

/**
 * 获取API Key列表
 * GET /api/admin/api-keys
 */
export default defineEventHandler(async (event) => {
  // 检查用户权限 - 只有超级管理员可以管理API Key
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: '只有超级管理员可以管理API Key'
    })
  }

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const search = (query.search as string) || ''
  const status = query.status as string // 'active', 'inactive', 'expired'

  const offset = (page - 1) * limit

  try {
    // 构建查询条件
    const whereConditions = []

    if (search) {
      whereConditions.push(
        sql`${apiKeys.name} ILIKE ${`%${search}%`} OR ${apiKeys.description} ILIKE ${`%${search}%`}`
      )
    }

    if (status === 'active') {
      whereConditions.push(
        and(
          eq(apiKeys.isActive, true),
          sql`(${apiKeys.expiresAt} IS NULL OR ${apiKeys.expiresAt} > NOW())`
        )
      )
    } else if (status === 'inactive') {
      whereConditions.push(eq(apiKeys.isActive, false))
    } else if (status === 'expired') {
      whereConditions.push(
        and(
          eq(apiKeys.isActive, true),
          sql`${apiKeys.expiresAt} IS NOT NULL AND ${apiKeys.expiresAt} <= NOW()`
        )
      )
    }

    const whereClause =
      whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions)
        : undefined

    // 获取API Key列表
    const apiKeysList = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,

        usageCount: apiKeys.usageCount,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
        createdByUserId: apiKeys.createdByUserId,
        creatorName: users.name
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.createdByUserId, users.id))
      .where(whereClause)
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset)

    // 获取总数
    const totalResult = await db.select({ count: count() }).from(apiKeys).where(whereClause)

    const total = totalResult[0]?.count || 0

    // 获取每个API Key的权限
    const apiKeyIds = apiKeysList.map((key) => key.id).filter((id) => id != null)
    let permissions = []
    if (apiKeyIds.length > 0) {
      try {
        permissions = await db
          .select({
            apiKeyId: apiKeyPermissions.apiKeyId,
            permission: apiKeyPermissions.permission
          })
          .from(apiKeyPermissions)
          .where(inArray(apiKeyPermissions.apiKeyId, apiKeyIds))

        // 确保permissions是数组
        if (!Array.isArray(permissions)) {
          permissions = []
        }
      } catch (permError) {
        console.error('获取权限数据失败:', permError)
        permissions = []
      }
    }

    // 组织权限数据
    const permissionsMap: Record<string, string[]> = {}
    try {
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        for (const perm of permissions) {
          if (
            perm &&
            typeof perm === 'object' &&
            perm.hasOwnProperty('apiKeyId') &&
            perm.hasOwnProperty('permission') &&
            perm.apiKeyId != null &&
            perm.permission != null
          ) {
            const apiKeyId = String(perm.apiKeyId)
            const permission = String(perm.permission)

            if (apiKeyId && permission) {
              if (!permissionsMap[apiKeyId]) {
                permissionsMap[apiKeyId] = []
              }
              permissionsMap[apiKeyId].push(permission)
            }
          }
        }
      }
    } catch (mapError) {
      console.error('组织权限数据失败:', mapError)
      // permissionsMap已经初始化为空对象，继续执行
    }

    // 组合结果
    let result = []
    try {
      if (Array.isArray(apiKeysList)) {
        result = apiKeysList
          .map((key) => {
            // 确保key对象存在且有必要的属性
            if (!key || typeof key !== 'object' || key.id == null) {
              return null
            }

            try {
              const keyId = String(key.id)
              const expiresAt = key.expiresAt ? new Date(key.expiresAt) : null
              const now = new Date()

              return {
                ...key,
                permissions: permissionsMap[keyId] || [],
                isExpired: expiresAt ? now > expiresAt : false,
                status: !key.isActive
                  ? 'inactive'
                  : expiresAt && now > expiresAt
                    ? 'expired'
                    : 'active'
              }
            } catch (keyError) {
              console.error('处理API Key数据失败:', keyError, key)
              return null
            }
          })
          .filter(Boolean) // 过滤掉null值
      }
    } catch (resultError) {
      console.error('组合结果失败:', resultError)
      result = []
    }

    return {
      success: true,
      data: {
        items: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `获取API Key列表失败: ${error.message}`
    })
  }
})
