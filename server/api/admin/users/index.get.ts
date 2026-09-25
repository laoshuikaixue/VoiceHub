import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { asc, desc, count, sql } from 'drizzle-orm'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'
import { buildUserFilterConditions } from '~~/server/utils/user-filter'

export default defineEventHandler(async (event) => {
  try {
    // 检查用户是否为管理员
    const user = event.context.user

    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        message: '只有系统管理员可以访问用户列表'
      })
    }

    const query = getQuery(event)
    const { grade, class: className, search, page = '1', limit = '50', role, status, sortBy = 'id', sortOrder = 'asc' } = query

    // 构建筛选条件
    const whereClause = buildUserFilterConditions(query)

    // 分页参数
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 1000)
    const skip = (pageNum - 1) * limitNum

    // 获取总数
    const totalResult = await db.select({ count: count() }).from(users).where(whereClause)
    const total = totalResult[0]?.count || 0

    // 排序逻辑
    let orderByClause
    if (sortBy === 'name') {
      // 对中文名进行拼音排序 (使用 GBK 编码转换 hack，适用于大多数常见汉字)
      orderByClause = sortOrder === 'desc' 
        ? sql`convert_to(${users.name}, 'GBK') DESC` 
        : sql`convert_to(${users.name}, 'GBK') ASC`
    } else if (sortBy === 'lastLogin') {
      // 确保未登录用户（NULL）排在最后
      orderByClause = sortOrder === 'desc' 
        ? sql`${users.lastLogin} DESC NULLS LAST` 
        : asc(users.lastLogin)
    } else if (sortBy === 'createdAt') {
      orderByClause = sortOrder === 'desc' ? desc(users.createdAt) : asc(users.createdAt)
    } else {
      // 默认按 id 排序
      orderByClause = sortOrder === 'desc' ? desc(users.id) : asc(users.id)
    }

    // 获取用户列表
    const usersList = await db.query.users.findMany({
      where: whereClause,
      orderBy: orderByClause,
      limit: limitNum,
      offset: skip,
      columns: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        status: true,
        statusChangedAt: true,
        lastLogin: true,
        lastLoginIp: true,
        passwordChangedAt: true,
        forcePasswordChange: true,
        meowNickname: true,
        meowBoundAt: true,
        email: true,
        emailVerified: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
        avatarProvider: true,
        avatarProviderUserId: true
      },
      with: {
        identities: {
          columns: {
            provider: true,
            providerUsername: true,
            providerUserId: true,
            avatar: true,
            createdAt: true
          }
        }
      }
    })

    // 处理用户列表，添加头像字段
    const formattedUsers = usersList.map((user) => {
      const avatarSource = resolveAvatarSource(user, user.identities || [])
      return {
        ...user,
        avatar: avatarSource?.url ?? null
      }
    })

    // 计算分页信息
    const totalPages = Math.ceil(total / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      success: true,
      users: formattedUsers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        grade: grade || null,
        class: className || null,
        role: role || null,
        status: status || null,
        search: search || null
      }
    }
  } catch (error: any) {
    console.error('获取用户列表失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取用户列表失败: ' + error.message
    })
  }
})
