import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq, inArray } from 'drizzle-orm'
import { cacheService } from '../../../services/cacheService'

interface UserData {
  name: string
  username: string
  password: string
  role?: string
  status?: 'active' | 'withdrawn' | 'graduate'
  grade?: string
  class?: string
}

interface ValidUserData extends UserData {
  index: number
}

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
    total: body.users.length,
    errors: [] as Array<{ index: number; username?: string; name?: string; reason: string }>
  }

  // 1. 预处理数据：过滤必填字段，提取要查询的用户名
  const validUsers: ValidUserData[] = []
  const usernamesToQuery: string[] = []

  for (let i = 0; i < body.users.length; i++) {
    const userData = body.users[i]
    if (!userData.name || !userData.username || !userData.password) {
      results.failed++
      results.errors.push({ index: i, username: userData.username, name: userData.name, reason: '缺少必填字段（姓名、账号或密码）' })
      continue
    }
    // 限制单次查询 inArray 的长度，如果需要的话。前端分批已经是 50，所以没问题
    validUsers.push({ index: i, ...userData })
    usernamesToQuery.push(userData.username)
  }

  if (validUsers.length === 0) {
    return results
  }

  // 2. 批量查询已存在的用户名，减少数据库交互
  let existingUsernames = new Set<string>()
  try {
    const existingUsersList = await db
      .select({ username: users.username })
      .from(users)
      .where(inArray(users.username, usernamesToQuery))
    
    existingUsernames = new Set(existingUsersList.map(u => u.username))
  } catch (error: any) {
    console.error('批量查询用户失败:', error)
    throw createError({
      statusCode: 500,
      message: '数据库查询错误'
    })
  }

  // 3. 过滤掉已存在的用户
  const usersToInsertData: ValidUserData[] = []
  for (const userData of validUsers) {
    if (existingUsernames.has(userData.username)) {
      results.failed++
      results.errors.push({ index: userData.index, username: userData.username, name: userData.name, reason: '账号已存在' })
      continue
    }
    usersToInsertData.push(userData)
  }

  if (usersToInsertData.length === 0) {
    return results
  }

  try {
    // 4. 并发加密密码 (由于使用 bcrypt.hash 异步方法，使用 Promise.all 并发处理可以显著提速)
    const hashedPasswords = await Promise.all(
      usersToInsertData.map(userData => bcrypt.hash(userData.password, 10))
    )

    // 5. 准备批量插入的数据
    const insertValues = usersToInsertData.map((userData, idx) => {
      // 角色权限控制
      let validRole = 'USER' // 默认角色
      if (userData.role) {
        const rolePermissions: Record<string, string[]> = {
          SUPER_ADMIN: ['USER', 'ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN'],
          ADMIN: ['USER', 'SONG_ADMIN']
        }
        const allowedRoles = rolePermissions[user.role]
        if (allowedRoles?.includes(userData.role)) {
          validRole = userData.role
        }
      }

      // 状态验证
      let validStatus = 'active'
      if (userData.status && ['active', 'withdrawn', 'graduate'].includes(userData.status)) {
        validStatus = userData.status
      }

      return {
        name: userData.name,
        username: userData.username,
        password: hashedPasswords[idx],
        role: validRole,
        status: validStatus as 'active' | 'withdrawn' | 'graduate',
        grade: userData.grade,
        class: userData.class
      }
    })

    // 6. 执行批量插入
    await db.insert(users).values(insertValues)
    results.created += insertValues.length

  } catch (error: any) {
    console.error(`批量插入用户失败:`, error)
    // 如果批量插入整体失败，则全部标记为失败
    for (const userData of usersToInsertData) {
      results.failed++
      results.errors.push({ index: userData.index, username: userData.username, name: userData.name, reason: error.message || '数据库批量写入失败' })
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
