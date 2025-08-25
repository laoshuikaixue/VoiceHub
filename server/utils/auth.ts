import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
    // 获取Authorization头
    const authHeader = getHeader(event, 'authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        message: '缺少认证令牌'
      }
    }

    // 提取token
    const token = authHeader.substring(7)
    
    if (!token) {
      return {
        success: false,
        message: '无效的认证令牌'
      }
    }

    // 验证JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET环境变量未设置')
      return {
        success: false,
        message: '服务器配置错误'
      }
    }

    let decoded: any
    try {
      decoded = jwt.verify(token, jwtSecret)
    } catch (jwtError) {
      console.error('JWT验证失败:', jwtError)
      return {
        success: false,
        message: '认证令牌无效或已过期'
      }
    }

    // 从数据库获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, name: true, role: true }
    })

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
    // 获取Authorization头
    const authHeader = getHeader(event, 'authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        message: '缺少认证令牌'
      }
    }

    // 提取token
    const token = authHeader.substring(7)
    
    if (!token) {
      return {
        success: false,
        message: '无效的认证令牌'
      }
    }

    // 验证JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET环境变量未设置')
      return {
        success: false,
        message: '服务器配置错误'
      }
    }

    let decoded: any
    try {
      decoded = jwt.verify(token, jwtSecret)
    } catch (jwtError) {
      console.error('JWT验证失败:', jwtError)
      return {
        success: false,
        message: '认证令牌无效或已过期'
      }
    }

    // 从数据库获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, name: true, role: true }
    })

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