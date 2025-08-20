import crypto from 'crypto'

// Token黑名单存储
const tokenBlacklist = new Map<string, { expiredAt: number; reason: string }>()

// 登录追踪存储（用于防暴力破解）
const loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil?: number }>()

// 会话指纹存储（用于验证token指纹）
const sessionFingerprints = new Map<string, { userAgent: string; createdAt: number }>()

/**
 * 内存存储管理类
 */
export class MemoryStore {
  /**
   * 将token添加到黑名单
   */
  static addToBlacklist(tokenId: string, expiredAt: number, reason: string = 'logout') {
    tokenBlacklist.set(tokenId, { expiredAt, reason })
    console.log(`Token ${tokenId} added to blacklist, reason: ${reason}`)
  }

  /**
   * 检查token是否在黑名单中
   */
  static isTokenBlacklisted(tokenId: string): boolean {
    const blacklistEntry = tokenBlacklist.get(tokenId)
    if (!blacklistEntry) return false
    
    // 如果token已过期，从黑名单中移除
    if (Date.now() > blacklistEntry.expiredAt) {
      tokenBlacklist.delete(tokenId)
      return false
    }
    
    return true
  }

  /**
   * 记录登录尝试
   */
  static recordLoginAttempt(identifier: string, success: boolean = false) {
    const now = Date.now()
    const attempt = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 }
    
    if (success) {
      // 登录成功，清除记录
      loginAttempts.delete(identifier)
    } else {
      // 登录失败，增加计数
      attempt.count += 1
      attempt.lastAttempt = now
      
      // 如果失败次数超过5次，锁定30分钟
      if (attempt.count >= 5) {
        attempt.blockedUntil = now + 30 * 60 * 1000 // 30分钟
      }
      
      loginAttempts.set(identifier, attempt)
    }
  }

  /**
   * 检查是否被锁定
   */
  static isBlocked(identifier: string): boolean {
    const attempt = loginAttempts.get(identifier)
    if (!attempt || !attempt.blockedUntil) return false
    
    const now = Date.now()
    if (now > attempt.blockedUntil) {
      // 锁定时间已过，清除记录
      loginAttempts.delete(identifier)
      return false
    }
    
    return true
  }

  /**
   * 获取剩余锁定时间（分钟）
   */
  static getRemainingBlockTime(identifier: string): number {
    const attempt = loginAttempts.get(identifier)
    if (!attempt || !attempt.blockedUntil) return 0
    
    const remaining = Math.ceil((attempt.blockedUntil - Date.now()) / (60 * 1000))
    return Math.max(0, remaining)
  }

  /**
   * 生成会话指纹
   */
  static generateSessionFingerprint(userAgent: string): string {
    const fingerprint = crypto.randomUUID()
    sessionFingerprints.set(fingerprint, {
      userAgent,
      createdAt: Date.now()
    })
    return fingerprint
  }

  /**
   * 验证会话指纹
   */
  static validateSessionFingerprint(fingerprint: string, userAgent: string): boolean {
    const session = sessionFingerprints.get(fingerprint)
    if (!session) return false
    
    // 检查User-Agent是否匹配
    return session.userAgent === userAgent
  }

  /**
   * 移除会话指纹
   */
  static removeSessionFingerprint(fingerprint: string) {
    sessionFingerprints.delete(fingerprint)
  }

  /**
   * 清理过期数据
   */
  static cleanup() {
    const now = Date.now()
    let cleanedCount = 0
    
    // 清理过期的黑名单token
    for (const [tokenId, entry] of tokenBlacklist.entries()) {
      if (now > entry.expiredAt) {
        tokenBlacklist.delete(tokenId)
        cleanedCount++
      }
    }
    
    // 清理过期的登录尝试记录（超过24小时）
    for (const [identifier, attempt] of loginAttempts.entries()) {
      if (now - attempt.lastAttempt > 24 * 60 * 60 * 1000) {
        loginAttempts.delete(identifier)
        cleanedCount++
      }
    }
    
    // 清理过期的会话指纹（超过7天）
    for (const [fingerprint, session] of sessionFingerprints.entries()) {
      if (now - session.createdAt > 7 * 24 * 60 * 60 * 1000) {
        sessionFingerprints.delete(fingerprint)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Memory cleanup completed: ${cleanedCount} entries removed`)
    }
  }



  /**
   * 清空所有存储（仅用于测试）
   */
  static clearAll() {
    tokenBlacklist.clear()
    loginAttempts.clear()
    sessionFingerprints.clear()
    console.log('All memory stores cleared')
  }

  // 清理定时器引用
  private static cleanupTimer: NodeJS.Timeout | null = null

  /**
   * 启动自动清理
   */
  static startAutoCleanup() {
    if (this.cleanupTimer) {
      console.log('Memory cleanup timer already running')
      return
    }
    
    // 启动自动清理定时器（每小时执行一次）
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, 60 * 60 * 1000)
    
    console.log('Memory cleanup timer started')
  }

  /**
   * 停止自动清理
   */
  static stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      console.log('Memory cleanup timer stopped')
    }
  }

  /**
   * 获取存储统计信息
   */
  static getStats() {
    return {
      blacklistedTokens: tokenBlacklist.size,
      loginAttempts: loginAttempts.size,
      sessionFingerprints: sessionFingerprints.size,
      totalItems: tokenBlacklist.size + loginAttempts.size + sessionFingerprints.size
    }
  }
}

// 导出单例实例
export default MemoryStore