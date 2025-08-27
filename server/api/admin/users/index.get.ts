import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'

export default defineEventHandler(async (event) => {
  try {
    // 获取查询参数
    const query = getQuery(event)
    const {
      grade,
      class: className,
      search,
      page = '1',
      limit = '50',
      role
    } = query

    // 构建筛选条件
    const where: any = {}

    // 年级筛选
    if (grade && typeof grade === 'string' && grade.trim()) {
      where.grade = grade.trim()
    }

    // 班级筛选
    if (className && typeof className === 'string' && className.trim()) {
      where.class = className.trim()
    }

    // 角色筛选
    if (role && typeof role === 'string' && role.trim()) {
      where.role = role.trim()
    }

    // 搜索功能（姓名或用户名）
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim()
      where.OR = [
        {
          name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          username: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ]
    }

    // 分页参数
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.max(1, parseInt(limit as string) || 50)
    const skip = (pageNum - 1) * limitNum

    // 获取总数
    const total = await db.user.count({ where })

    // 获取用户列表
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        grade: true,
        class: true,
        lastLogin: true,
        lastLoginIp: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        id: 'asc'
      },
      skip,
      take: limitNum
    })

    // 计算分页信息
    const totalPages = Math.ceil(total / limitNum)
    const hasNextPage = pageNum < totalPages
    const hasPrevPage = pageNum > 1

    return {
      success: true,
      users,
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
        search: search || null
      }
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
    throw createError({
      statusCode: 500,
      statusMessage: '获取用户列表失败: ' + error.message
    })
  }
})
