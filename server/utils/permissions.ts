import { prisma } from '../models/schema'

// 权限检查缓存
const permissionCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

interface UserPermissions {
  userId: number
  role: string
  permissions: Set<string>
  cachedAt: number
}

/**
 * 获取用户权限
 */
export async function getUserPermissions(userId: number): Promise<Set<string>> {
  const cacheKey = `user_${userId}`
  const cached = permissionCache.get(cacheKey) as UserPermissions
  
  // 检查缓存
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return cached.permissions
  }

  try {
    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    if (!user) {
      return new Set()
    }

    const permissions = new Set<string>()

    // 获取角色权限
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { 
        role: user.role,
        granted: true
      },
      include: {
        permission: true
      }
    })

    rolePermissions.forEach(rp => {
      permissions.add(rp.permission.name)
    })

    // 获取用户个人权限（覆盖角色权限）
    const userPermissions = await prisma.userPermission.findMany({
      where: { userId },
      include: {
        permission: true
      }
    })

    userPermissions.forEach(up => {
      if (up.granted) {
        permissions.add(up.permission.name)
      } else {
        permissions.delete(up.permission.name)
      }
    })

    // 缓存结果
    permissionCache.set(cacheKey, {
      userId,
      role: user.role,
      permissions,
      cachedAt: Date.now()
    })

    return permissions
  } catch (error) {
    console.error('获取用户权限失败:', error)
    return new Set()
  }
}

/**
 * 检查用户是否有指定权限
 */
export async function hasPermission(userId: number, permission: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.has(permission)
}

/**
 * 检查用户是否有任一权限
 */
export async function hasAnyPermission(userId: number, permissions: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  return permissions.some(permission => userPermissions.has(permission))
}

/**
 * 检查用户是否有所有权限
 */
export async function hasAllPermissions(userId: number, permissions: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  return permissions.every(permission => userPermissions.has(permission))
}

/**
 * 清除用户权限缓存
 */
export function clearUserPermissionCache(userId: number) {
  const cacheKey = `user_${userId}`
  permissionCache.delete(cacheKey)
}

/**
 * 清除所有权限缓存
 */
export function clearAllPermissionCache() {
  permissionCache.clear()
}

/**
 * 权限检查中间件工厂
 */
export function requirePermission(permission: string) {
  return async (event: any) => {
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '需要登录'
      })
    }

    const hasAccess = await hasPermission(user.id, permission)
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: '权限不足'
      })
    }

    return true
  }
}

/**
 * 多权限检查中间件工厂（任一权限）
 */
export function requireAnyPermission(permissions: string[]) {
  return async (event: any) => {
    const user = event.context.user
    if (!user) {
      throw createError({
        statusCode: 401,
        message: '需要登录'
      })
    }

    const hasAccess = await hasAnyPermission(user.id, permissions)
    if (!hasAccess) {
      throw createError({
        statusCode: 403,
        message: '权限不足'
      })
    }

    return true
  }
}
