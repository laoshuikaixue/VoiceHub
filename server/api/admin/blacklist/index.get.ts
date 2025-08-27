import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '需要管理员权限'
    })
  }

  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const type = query.type as string
  const search = query.search as string

  try {
    // 构建查询条件
    const where = {
      ...(type && { type }),
      ...(search && {
        value: {
          contains: search,
          mode: 'insensitive'
        }
      })
    }

    // 获取总数
    const total = await prisma.songBlacklist.count({ where })

    // 获取黑名单列表
    const blacklist = await prisma.songBlacklist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return {
      blacklist,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    console.error('获取黑名单失败:', error)
    throw createError({
      statusCode: 500,
      message: '获取黑名单失败'
    })
  }
})
