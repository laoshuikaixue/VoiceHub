import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq, inArray } from 'drizzle-orm'
import { getAdminPasswordViolation } from '~~/server/utils/admin-password-policy'

interface UserData {
  name: string
  username: string
  password: string
  role?: string
  status?: 'active' | 'withdrawn' | 'graduate'
  grade?: string | null
  class?: string | null
}

interface ValidUserData extends UserData {
  index: number
}

const normalizeRequiredText = (value: unknown) => String(value || '').trim()
const normalizeOptionalText = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

// 单次批量创建的上限：前端按 50 一批提交，服务端独立设限防止超大请求打满内存与 CPU
const MAX_BATCH_SIZE = 500
// bcrypt cost=10 单次约 60~100ms CPU，Promise.all 一次性并发 500 次会耗尽事件循环并拖垮同进程其他请求
const BCRYPT_CONCURRENCY = 4

/** 以固定并发度执行 bcrypt，避免大批量创建时 CPU 被打满（DoS）。 */
async function hashPasswordsWithLimit(
  items: ValidUserData[],
  concurrency: number = BCRYPT_CONCURRENCY
): Promise<string[]> {
  const results: string[] = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await bcrypt.hash(items[index]!.password, 10)
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
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

  if (body.users.length > MAX_BATCH_SIZE) {
    throw createError({
      statusCode: 400,
      message: `单次批量创建不能超过 ${MAX_BATCH_SIZE} 个账号`
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
  const usernamesInBatch = new Set<string>()

  for (let i = 0; i < body.users.length; i++) {
    const userData = body.users[i]
    const normalizedUserData = {
      ...userData,
      name: normalizeRequiredText(userData.name),
      username: normalizeRequiredText(userData.username),
      grade: normalizeOptionalText(userData.grade),
      class: normalizeOptionalText(userData.class)
    }

    if (
      !normalizedUserData.name ||
      !normalizedUserData.username ||
      typeof userData.password !== 'string' ||
      !userData.password
    ) {
      results.failed++
      results.errors.push({
        index: i,
        username: userData.username,
        name: userData.name,
        reason: '缺少必填字段（姓名、账号或密码）'
      })
      continue
    }

    const passwordViolation = getAdminPasswordViolation(userData.password)
    if (passwordViolation) {
      results.failed++
      results.errors.push({
        index: i,
        username: normalizedUserData.username,
        name: normalizedUserData.name,
        reason: passwordViolation.message
      })
      continue
    }

    if (usernamesInBatch.has(normalizedUserData.username)) {
      results.failed++
      results.errors.push({
        index: i,
        username: normalizedUserData.username,
        name: normalizedUserData.name,
        reason: '批处理中存在重复的账号'
      })
      continue
    }

    usernamesInBatch.add(normalizedUserData.username)
    // 限制单次查询 inArray 的长度，如果需要的话。前端分批已经是 50，所以没问题
    validUsers.push({ index: i, ...normalizedUserData })
    usernamesToQuery.push(normalizedUserData.username)
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

    existingUsernames = new Set(existingUsersList.map((u) => u.username))
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
      results.errors.push({
        index: userData.index,
        username: userData.username,
        name: userData.name,
        reason: '账号已存在'
      })
      continue
    }
    usersToInsertData.push(userData)
  }

  if (usersToInsertData.length === 0) {
    return results
  }

  try {
    // 4. 并发加密密码 (使用受限并发，避免大批量创建时 bcrypt 打满 CPU 造成拒绝服务)
    const hashedPasswords = await hashPasswordsWithLimit(usersToInsertData)

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
        password: hashedPasswords[idx]!,
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
      results.errors.push({
        index: userData.index,
        username: userData.username,
        name: userData.name,
        reason: error.message || '数据库批量写入失败'
      })
    }
  }

  return results
})
