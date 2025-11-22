import {JWTEnhanced} from '../utils/jwt-enhanced'
import {db, users} from '~/drizzle/db'
import {eq} from 'drizzle-orm'
import {isUserBlocked, getUserBlockRemainingTime} from '../services/securityService'

export default defineEventHandler(async (event) => {
    // 清除用户上下文
    if (event.context.user) {
        delete event.context.user
    }

    const url = getRequestURL(event)
    const pathname = url.pathname

    // 跳过非API路由
    if (!pathname.startsWith('/api/')) {
        return
    }

    // 公共API路径
    const publicApiPaths = [
        '/api/auth/login',
        '/api/auth/verify', // verify端点自行处理token验证
        '/api/semesters/current',
        '/api/play-times',
        '/api/schedules/public',
        '/api/songs/count',
        '/api/songs/public',
        '/api/site-config',
        '/api/proxy/', // 代理API路径，用于图片代理等功能
        '/api/open/' // 开放API路径，由api-auth中间件处理认证
    ]

    // 公共路径跳过认证检查
    if (publicApiPaths.some(path => pathname.startsWith(path))) {
        return
    }

    // 从请求头或cookie获取token
    let token: string | null = null
    const authHeader = getRequestHeader(event, 'authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7)
    }

    if (!token) {
        token = getCookie(event, 'auth-token') || null
    }

    // 受保护路由缺少token时返回401错误
    if (!token) {
        return sendError(event, createError({
            statusCode: 401,
            message: '未授权访问：缺少有效的认证信息'
        }))
    }

    try {
        // 验证token并获取用户信息
        const decoded = JWTEnhanced.verifyToken(token)
        const userResult = await db.select({
            id: users.id,
            username: users.username,
            name: users.name,
            grade: users.grade,
            class: users.class,
            role: users.role
        }).from(users).where(eq(users.id, decoded.userId)).limit(1)

        const user = userResult[0] || null

        // 用户不存在时token无效
        if (!user) {
            return sendError(event, createError({
                statusCode: 401,
                message: '用户不存在，请重新登录'
            }))
        }

        event.context.user = user

        if (isUserBlocked(user.id)) {
            delete event.context.user
            const remaining = getUserBlockRemainingTime(user.id)
            return sendError(event, createError({
                statusCode: 401,
                message: `账户处于风险控制期，请在 ${remaining} 分钟后重试`
            }))
        }

        // 检查管理员专用路由
        if (pathname.startsWith('/api/admin') && !['ADMIN', 'SUPER_ADMIN', 'SONG_ADMIN'].includes(user.role)) {
            return sendError(event, createError({
                statusCode: 403,
                message: '需要管理员权限'
            }))
        }
    } catch (error: any) {
        // 处理JWT验证错误
        return sendError(event, createError({
            statusCode: 401,
            message: `认证失败: ${error.message}`,
            data: {invalidToken: true}
        }))
    }
})
