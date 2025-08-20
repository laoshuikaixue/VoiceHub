import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { MemoryStore } from './memory-store'

// Token类型枚举
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh'
}

// JWT载荷接口
export interface JWTPayload {
  userId: number
  role: string
  sessionId: string
  fingerprint: string
  tokenType: TokenType
  jti: string // JWT ID，用于唯一标识token
  iat?: number
  exp?: number
}

// Token对接口
export interface TokenPair {
  accessToken: string
  refreshToken: string
  sessionId: string
  fingerprint: string
}

/**
 * 增强的JWT工具类
 */
export class JWTEnhanced {
  private static readonly JWT_SECRET = process.env.JWT_SECRET as string
  private static readonly ACCESS_TOKEN_EXPIRES = '15m' // 15分钟
  private static readonly REFRESH_TOKEN_EXPIRES = '7d' // 7天

  /**
   * 生成token对（access + refresh）
   */
  static generateTokenPair(
    userId: number,
    role: string,
    userAgent: string
  ): TokenPair {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set')
    }

    // 生成会话ID和指纹
    const sessionId = crypto.randomUUID()
    const fingerprint = MemoryStore.generateSessionFingerprint(userAgent)

    // 生成唯一的JWT ID
    const accessJti = crypto.randomUUID()
    const refreshJti = crypto.randomUUID()

    // Access Token载荷
    const accessPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      role,
      sessionId,
      fingerprint,
      tokenType: TokenType.ACCESS,
      jti: accessJti
    }

    // Refresh Token载荷
    const refreshPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      role,
      sessionId,
      fingerprint,
      tokenType: TokenType.REFRESH,
      jti: refreshJti
    }

    // 生成tokens
    const accessToken = jwt.sign(accessPayload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES
    })

    const refreshToken = jwt.sign(refreshPayload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES
    })

    console.log(`Generated token pair for user ${userId}, session: ${sessionId}`)

    return {
      accessToken,
      refreshToken,
      sessionId,
      fingerprint
    }
  }

  /**
   * 验证并解码token
   */
  static verifyToken(token: string, userAgent: string): JWTPayload {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set')
    }

    try {
      // 解码token
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload

      // 检查token是否在黑名单中
      if (MemoryStore.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Token has been revoked')
      }

      // 验证会话指纹
      if (!MemoryStore.validateSessionFingerprint(decoded.fingerprint, userAgent)) {
        throw new Error('Invalid session fingerprint')
      }

      return decoded
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired')
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token')
      }
      throw error
    }
  }

  /**
   * 刷新access token
   */
  static refreshAccessToken(refreshToken: string, userAgent: string): string {
    // 验证refresh token
    const decoded = this.verifyToken(refreshToken, userAgent)

    // 确保是refresh token
    if (decoded.tokenType !== TokenType.REFRESH) {
      throw new Error('Invalid token type for refresh')
    }

    // 生成新的access token
    const newAccessJti = crypto.randomUUID()
    const accessPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: decoded.userId,
      role: decoded.role,
      sessionId: decoded.sessionId,
      fingerprint: decoded.fingerprint,
      tokenType: TokenType.ACCESS,
      jti: newAccessJti
    }

    const newAccessToken = jwt.sign(accessPayload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES
    })

    console.log(`Refreshed access token for user ${decoded.userId}, session: ${decoded.sessionId}`)

    return newAccessToken
  }

  /**
   * 撤销token（添加到黑名单）
   */
  static revokeToken(token: string, reason: string = 'logout') {
    try {
      // 解码token获取信息（不验证过期时间）
      const decoded = jwt.decode(token) as JWTPayload
      if (!decoded || !decoded.jti || !decoded.exp) {
        throw new Error('Invalid token format')
      }

      // 添加到黑名单
      MemoryStore.addToBlacklist(decoded.jti, decoded.exp * 1000, reason)

      // 移除会话指纹
      if (decoded.fingerprint) {
        MemoryStore.removeSessionFingerprint(decoded.fingerprint)
      }

      console.log(`Token revoked: ${decoded.jti}, reason: ${reason}`)
    } catch (error) {
      console.error('Error revoking token:', error)
      throw new Error('Failed to revoke token')
    }
  }

  /**
   * 撤销会话的所有token
   */
  static revokeSession(sessionId: string, reason: string = 'logout') {
    // 注意：这里我们无法直接从内存中找到所有相关token
    // 在实际使用中，当验证token时会检查黑名单
    // 这个方法主要用于记录会话撤销的意图
    console.log(`Session revoked: ${sessionId}, reason: ${reason}`)
  }

  /**
   * 获取token信息（不验证）
   */
  static getTokenInfo(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload
    } catch (error) {
      return null
    }
  }

  /**
   * 检查token是否即将过期（5分钟内）
   */
  static isTokenExpiringSoon(token: string): boolean {
    const decoded = this.getTokenInfo(token)
    if (!decoded || !decoded.exp) return true

    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = decoded.exp - now
    
    // 如果5分钟内过期，返回true
    return timeUntilExpiry <= 5 * 60
  }

  /**
   * 获取token剩余有效时间（秒）
   */
  static getTokenRemainingTime(token: string): number {
    const decoded = this.getTokenInfo(token)
    if (!decoded || !decoded.exp) return 0

    const now = Math.floor(Date.now() / 1000)
    return Math.max(0, decoded.exp - now)
  }

  // 清理定时器引用
  private static cleanupTimer: NodeJS.Timeout | null = null

  /**
   * 启动自动清理
   */
  static startAutoCleanup() {
    if (this.cleanupTimer) {
      console.log('JWT cleanup timer already running')
      return
    }
    
    // 启动自动清理定时器（每小时执行一次，与MemoryStore同步）
    this.cleanupTimer = setInterval(() => {
      // JWT增强模块主要依赖MemoryStore进行清理
      // 这里可以添加JWT特定的清理逻辑
      console.log('JWT Enhanced cleanup executed')
    }, 60 * 60 * 1000)
    
    console.log('JWT cleanup timer started')
  }

  /**
   * 停止自动清理
   */
  static stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      console.log('JWT cleanup timer stopped')
    }
  }

  /**
   * 清空所有数据（主要调用MemoryStore）
   */
  static clearAll() {
    // JWT增强模块的数据主要存储在MemoryStore中
    MemoryStore.clearAll()
    console.log('JWT Enhanced data cleared')
  }

  /**
   * 获取统计信息
   */
  static getStats() {
    // 返回MemoryStore的统计信息，因为JWT数据存储在那里
    const memoryStats = MemoryStore.getStats()
    return {
      ...memoryStats,
      jwtModule: 'active'
    }
  }
}

// 导出默认实例
export default JWTEnhanced