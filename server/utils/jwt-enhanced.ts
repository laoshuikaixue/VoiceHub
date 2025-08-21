import jwt from 'jsonwebtoken'

// 简化的JWT载荷接口
export interface JWTPayload {
  userId: number
  role: string
  jti: string // JWT ID，用于唯一标识token
  iat?: number
  exp?: number
}

/**
 * 简化的JWT工具类 - 仅支持单一JWT token验证
 */
export class JWTEnhanced {
  private static readonly JWT_SECRET = process.env.JWT_SECRET as string
  private static readonly TOKEN_EXPIRES = '24h' // 24小时有效期

  /**
   * 生成JWT token
   */
  static generateToken(userId: number, role: string): string {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set')
    }

    // 生成唯一的JWT ID
    const jti = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // JWT载荷
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      role,
      jti
    }

    // 生成token
    const token = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.TOKEN_EXPIRES
    })

    console.log(`Generated JWT token for user ${userId}`)
    return token
  }

  /**
   * 验证并解码token
   */
  static verifyToken(token: string): JWTPayload {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set')
    }

    try {
      // 验证并解码token
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload

      // 验证必要字段
      if (!decoded.userId || !decoded.role || !decoded.jti) {
        throw new Error('Invalid token payload: missing required fields')
      }

      return decoded
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired')
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature')
      }
      if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet')
      }
      throw new Error(`Token verification failed: ${error.message}`)
    }
  }

  /**
   * 获取token信息（不验证签名）
   */
  static getTokenInfo(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload
      return decoded && decoded.userId ? decoded : null
    } catch (error) {
      return null
    }
  }

  /**
   * 检查token是否已过期
   */
  static isTokenExpired(token: string): boolean {
    const decoded = this.getTokenInfo(token)
    if (!decoded || !decoded.exp) return true

    const now = Math.floor(Date.now() / 1000)
    return decoded.exp <= now
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
}

// 导出默认实例
export default JWTEnhanced