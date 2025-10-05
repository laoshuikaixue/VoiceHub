import {db} from '~/drizzle/db'
import {users} from '~/drizzle/schema'
import {eq} from 'drizzle-orm'

export default defineEventHandler(async (event) => {
    // 检查认证和权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        throw createError({
            statusCode: 403,
            message: '没有权限访问'
        })
    }

    // 安全获取ID参数
    const params = event.context.params || {}
    const id = parseInt(params.id || '')

    if (isNaN(id)) {
        throw createError({
            statusCode: 400,
            message: '无效的用户ID'
        })
    }

    // 处理PUT请求 - 更新用户
    if (event.method === 'PUT') {
        const body = await readBody(event)

        if (!body.name) {
            throw createError({
                statusCode: 400,
                message: '姓名不能为空'
            })
        }

        try {
            const updatedUserResult = await db.update(users)
                .set({
                    name: body.name,
                    role: body.role,
                    grade: body.grade,
                    class: body.class
                })
                .where(eq(users.id, id))
                .returning({
                    id: users.id,
                    name: users.name,
                    role: users.role,
                    createdAt: users.createdAt,
                    updatedAt: users.updatedAt,
                    grade: users.grade,
                    class: users.class,
                    username: users.username,
                    passwordChangedAt: users.passwordChangedAt
                })
            const updatedUser = updatedUserResult[0]

            return updatedUser
        } catch (error) {
            console.error('更新用户失败:', error)
            throw createError({
                statusCode: 500,
                message: '更新用户失败'
            })
        }
    }

    // 处理DELETE请求 - 删除用户
    if (event.method === 'DELETE') {
        try {
            // 确保不能删除自己
            if (id === user.userId) {
                throw createError({
                    statusCode: 400,
                    message: '不能删除当前登录的用户'
                })
            }

            await db.delete(users)
                .where(eq(users.id, id))

            return {success: true}
        } catch (error) {
            console.error('删除用户失败:', error)
            throw createError({
                statusCode: 500,
                message: '删除用户失败'
            })
        }
    }

    throw createError({
        statusCode: 405,
        message: '不支持的请求方法'
    })
})