import {createError, defineEventHandler, getQuery} from 'h3'
import {db} from '~/drizzle/db'
import {users} from '~/drizzle/schema'
import {and, asc, count, eq, ilike, or} from 'drizzle-orm'

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
            role,
            status
        } = query

        // 构建筛选条件
        const whereConditions = []

        // 年级筛选
        if (grade && typeof grade === 'string' && grade.trim()) {
            whereConditions.push(eq(users.grade, grade.trim()))
        }

        // 班级筛选
        if (className && typeof className === 'string' && className.trim()) {
            whereConditions.push(eq(users.class, className.trim()))
        }

        // 角色筛选
        if (role && typeof role === 'string' && role.trim()) {
            whereConditions.push(eq(users.role, role.trim()))
        }

        // 状态筛选
        if (status && typeof status === 'string' && status.trim()) {
            whereConditions.push(eq(users.status, status.trim()))
        }

        // 搜索功能（姓名、用户名或IP地址）
        if (search && typeof search === 'string' && search.trim()) {
            const searchTerm = search.trim()
            whereConditions.push(
                or(
                    ilike(users.name, `%${searchTerm}%`),
                    ilike(users.username, `%${searchTerm}%`),
                    ilike(users.lastLoginIp, `%${searchTerm}%`)
                )
            )
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

        // 分页参数
        const pageNum = Math.max(1, parseInt(page as string) || 1)
        const limitNum = Math.max(1, parseInt(limit as string) || 50)
        const skip = (pageNum - 1) * limitNum

        // 获取总数
        const totalResult = await db.select({count: count()})
            .from(users)
            .where(whereClause)
        const total = totalResult[0].count

        // 获取用户列表
        const usersList = await db.select({
            id: users.id,
            name: users.name,
            username: users.username,
            role: users.role,
            grade: users.grade,
            class: users.class,
            status: users.status,
            statusChangedAt: users.statusChangedAt,
            lastLogin: users.lastLogin,
            lastLoginIp: users.lastLoginIp,
            passwordChangedAt: users.passwordChangedAt,
            forcePasswordChange: users.forcePasswordChange,
            meowNickname: users.meowNickname,
            meowBoundAt: users.meowBoundAt,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt
        })
            .from(users)
            .where(whereClause)
            .orderBy(asc(users.id))
            .limit(limitNum)
            .offset(skip)

        // 计算分页信息
        const totalPages = Math.ceil(total / limitNum)
        const hasNextPage = pageNum < totalPages
        const hasPrevPage = pageNum > 1

        return {
            success: true,
            users: usersList,
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
    } catch (error) {
        console.error('获取用户列表失败:', error)
        throw createError({
            statusCode: 500,
            statusMessage: '获取用户列表失败: ' + error.message
        })
    }
})
