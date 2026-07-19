import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { passwordAuditLogs, users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'

interface PasswordAuditContext {
  action: string
  ipAddress: string
  userAgent: string | null
}

/**
 * 更新用户密码
 * 包含：加密密码、更新密码修改时间、清除用户缓存
 * @param userId 用户ID
 * @param newPassword 新密码
 * @param forceReset 是否强制用户下次登录时修改密码 (默认为 false)
 */
export async function updateUserPassword(
  userId: number,
  newPassword: string,
  forceReset: boolean = false,
  auditContext?: PasswordAuditContext
): Promise<{ passwordChangedAt: Date; tokenVersion: number }> {
  // 1. 加密新密码
  const hashedNewPassword = await bcrypt.hash(newPassword, 12)

  // 2. 更新数据库
  const passwordChangedAt = getBeijingTime()
  const updated = await db.transaction(async (tx) => {
    const result = await tx
      .update(users)
      .set({
        password: hashedNewPassword,
        passwordChangedAt,
        forcePasswordChange: forceReset,
        tokenVersion: sql`${users.tokenVersion} + 1`
      })
      .where(eq(users.id, userId))
      .returning({
        passwordChangedAt: users.passwordChangedAt,
        tokenVersion: users.tokenVersion
      })

    const updatedUser = result[0]
    if (!updatedUser) {
      throw new Error('用户不存在')
    }

    if (auditContext) {
      await tx.insert(passwordAuditLogs).values({
        userId,
        action: auditContext.action,
        success: true,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        failureReason: null
      })
    }

    return updatedUser
  })

  // 3. 清除用户认证缓存
  try {
    const { userCache } = await import('~~/server/utils/cache-helpers')
    await userCache.clearAuth(String(userId))
    console.log(`[Cache] 用户认证缓存已清除（密码修改）: ${userId}`)
  } catch (cacheError) {
    console.warn('[Cache] 清除用户认证缓存失败:', cacheError)
  }

  return {
    passwordChangedAt: updated.passwordChangedAt || passwordChangedAt,
    tokenVersion: updated.tokenVersion
  }
}
