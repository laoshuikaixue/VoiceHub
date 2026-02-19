import bcrypt from 'bcrypt'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'

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

  const body = await readBody(event)

  if (!body.newPassword) {
    throw createError({
      statusCode: 400,
      message: '新密码不能为空'
    })
  }

  try {
    // 禁止对自身进行密码重置（通过用户管理界面）
    if (id === user.id) {
      throw createError({
        statusCode: 400,
        message: '禁止在用户管理中重置自己的密码'
      })
    }
    // 查询用户是否存在
    const userExistsResult = await db.select().from(users).where(eq(users.id, id)).limit(1)
    const userExists = userExistsResult[0]

    if (!userExists) {
      throw createError({
        statusCode: 404,
        message: '用户不存在'
      })
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(body.newPassword, 10)

    // 更新密码，清空passwordChangedAt字段，强制用户下次登录时修改密码
    await db
      .update(users)
      .set({
        password: hashedPassword,
        passwordChangedAt: null, // 清空密码修改时间，强制用户修改密码
        forcePasswordChange: true // 强制用户修改密码
      })
      .where(eq(users.id, id))

    // 清除该用户的认证缓存（密码已重置）
    try {
      const { cache } = await import('~~/server/utils/cache-helpers')
      await cache.delete(`auth:user:${id}`)
      console.log(`[Cache] 用户认证缓存已清除（密码重置）: ${id}`)
    } catch (cacheError) {
      console.warn('[Cache] 清除用户认证缓存失败:', cacheError)
    }

    return {
      success: true,
      message: '密码重置成功'
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    throw createError({
      statusCode: 500,
      message: '重置密码失败'
    })
  }
})
