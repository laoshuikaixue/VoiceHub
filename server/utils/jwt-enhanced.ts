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
  private static readonly TOKEN_EXPIRES = '7d' // 7天有效期
  private static readonly REFRESH_THRESHOLD = 24 * 60 * 60 // 24小时（秒），剩余时间少于此值时自动续期

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

  /**
   * 检查token是否需要续期
   * @param token JWT token
   * @param thresholdSeconds 续期阈值（秒），默认24小时
   * @returns 是否需要续期
   */
  static shouldRefreshToken(
    token: string,
    thresholdSeconds: number = this.REFRESH_THRESHOLD
  ): boolean {
    const remainingTime = this.getTokenRemainingTime(token)
    return remainingTime > 0 && remainingTime <= thresholdSeconds
  }

  /**
   * 刷新token（生成新的token）
   * @param oldToken 旧的token
   * @returns 新的token
   */
  static refreshToken(oldToken: string): string {
    const decoded = this.verifyToken(oldToken)

    // 使用原有的用户信息生成新token
    return this.generateToken(decoded.userId, decoded.role)
  }

  /**
   * 验证token并自动续期（如果需要）
   * @param token JWT token
   * @returns { valid: boolean, payload?: JWTPayload, newToken?: string }
   */
  static verifyAndRefresh(token: string): {
    valid: boolean
    payload?: JWTPayload
    newToken?: string
  } {
    try {
      const payload = this.verifyToken(token)

      // 检查是否需要续期
      if (this.shouldRefreshToken(token)) {
        const newToken = this.refreshToken(token)
        console.log(`Token auto-refreshed for user ${payload.userId}`)
        return {
          valid: true,
          payload,
          newToken
        }
      }

      return {
        valid: true,
        payload
      }
    } catch (error) {
      return {
        valid: false
      }
    }
  }
}

// 导出默认实例
export default JWTEnhanced
