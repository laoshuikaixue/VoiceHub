import bcrypt from 'bcrypt'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { cacheService } from '../../../services/cacheService'

export default defineEventHandler(async (event) => {
  // 检查认证和权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: '没有权限访问'
    })
  }

  const body = await readBody(event)

  if (!body.users || !Array.isArray(body.users) || body.users.length === 0) {
    throw createError({
      statusCode: 400,
      message: '无效的用户数据'
    })
  }

  const results = {
    created: 0,
    failed: 0,
    total: body.users.length
  }

  // 批量添加用户
  for (let i = 0; i < body.users.length; i++) {
    const userData = body.users[i]

    try {
      // 验证必填字段
      if (!userData.name || !userData.username || !userData.password) {
        results.failed++
        continue
      }

      // 检查用户名是否已存在
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.username, userData.username))
        .limit(1)

      if (existingUser.length > 0) {
        results.failed++
        continue
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      // 角色权限控制
      let validRole = 'USER' // 默认角色
      if (userData.role) {
        if (user.role === 'SUPER_ADMIN') {
          // 超级管理员可以设置任何角色
          const allowedRoles = ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']
          if (allowedRoles.includes(userData.role)) {
            validRole = userData.role
          }
        } else if (user.role === 'ADMIN') {
          // 普通管理员只能设置 USER 和 SONG_ADMIN 角色
          const allowedRoles = ['USER', 'SONG_ADMIN']
          if (allowedRoles.includes(userData.role)) {
            validRole = userData.role
          }
        }
      }

      // 创建用户
      const newUser = await db
        .insert(users)
        .values({
          name: userData.name,
          username: userData.username,
          password: hashedPassword,
          role: validRole,
          grade: userData.grade,
          class: userData.class
        })
        .returning()

      results.created++
    } catch (error) {
      console.error(`用户创建失败:`, error)
      results.failed++
    }
  }

  // 如果有用户创建成功，清除相关缓存
  if (results.created > 0) {
    try {
      await cacheService.clearSongsCache()
      console.log('批量用户创建后缓存清除成功')
    } catch (cacheError) {
      console.error('批量用户创建后缓存清除失败:', cacheError)
    }
  }

  return results
})
