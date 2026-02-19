import { getCookie, getHeader } from 'h3'
import { JWTEnhanced } from './jwt-enhanced'
import { db, eq, users } from '~/drizzle/db'

interface AuthResult {
  success: boolean
  message: string
  user?: any
}

/**
 * 验证管理员权限
 * @param event - Nuxt事件对象
 * @returns 验证结果
 */
export async function verifyAdminAuth(event: any): Promise<AuthResult> {
  try {
    // 首先检查认证中间件是否已经验证了用户
    if (event.context?.user) {
      const user = event.context.user
      // 检查用户角色
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        return {
          success: false,
          message: '权限不足，需要管理员权限'
        }
      }

      return {
        success: true,
        message: '认证成功',
        user: user
      }
    }

    // 如果context中没有用户信息，尝试从Authorization头或cookie获取token
    let token: string | null = null
    const authHeader = getHeader(event, 'authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    if (!token) {
      token = getCookie(event, 'auth-token') || null
    }

    if (!token) {
      return {
        success: false,
        message: '缺少认证令牌'
      }
    }

    // 验证JWT token
    let decoded: any
    try {
      decoded = JWTEnhanced.verifyToken(token)
    } catch (jwtError) {
      console.error('JWT验证失败:', jwtError)
      return {
        success: false,
        message: '认证令牌无效或已过期'
      }
    }

    // 从数据库获取用户信息
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1)
    const user = userResult[0]

    if (!user) {
      console.error('获取用户信息失败: 用户不存在')
      return {
        success: false,
        message: '用户不存在'
      }
    }

    // 检查用户角色
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        message: '权限不足，需要管理员权限'
      }
    }

    return {
      success: true,
      message: '认证成功',
      user: user
    }
  } catch (error) {
    console.error('权限验证过程中出错:', error)
    return {
      success: false,
      message: '权限验证失败'
    }
  }
}

/**
 * 验证超级管理员权限
 * @param event - Nuxt事件对象
 * @returns 验证结果
 */
export async function verifySuperAdminAuth(event: any): Promise<AuthResult> {
  const authResult = await verifyAdminAuth(event)

  if (!authResult.success) {
    return authResult
  }

  if (authResult.user?.role !== 'SUPER_ADMIN') {
    return {
      success: false,
      message: '权限不足，需要超级管理员权限'
    }
  }

  return authResult
}

/**
 * 验证用户权限（包括普通用户）
 * @param event - Nuxt事件对象
 * @returns 验证结果
 */
export async function verifyUserAuth(event: any): Promise<AuthResult> {
  try {
    // 首先检查认证中间件是否已经验证了用户
    if (event.context?.user) {
      return {
        success: true,
        message: '认证成功',
        user: event.context.user
      }
    }

    // 如果context中没有用户信息，尝试从Authorization头或cookie获取token
    let token: string | null = null
    const authHeader = getHeader(event, 'authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    if (!token) {
      token = getCookie(event, 'auth-token') || null
    }

    if (!token) {
      return {
        success: false,
        message: '缺少认证令牌'
      }
    }

    // 验证JWT token
    let decoded: any
    try {
      decoded = JWTEnhanced.verifyToken(token)
    } catch (jwtError) {
      console.error('JWT验证失败:', jwtError)
      return {
        success: false,
        message: '认证令牌无效或已过期'
      }
    }

    // 从数据库获取用户信息
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1)
    const user = userResult[0]

    if (!user) {
      console.error('获取用户信息失败: 用户不存在')
      return {
        success: false,
        message: '用户不存在'
      }
    }

    return {
      success: true,
      message: '认证成功',
      user: user
    }
  } catch (error) {
    console.error('权限验证过程中出错:', error)
    return {
      success: false,
      message: '权限验证失败'
    }
  }
}
