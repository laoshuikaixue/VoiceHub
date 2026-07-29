import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { passwordAuditLogs, users } from '~/drizzle/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'
import { createApiError } from '~~/server/utils/apiError'

interface PasswordAuditContext {
  action: string
  ipAddress: string
  userAgent: string | null
  actorId?: number | null
}

interface UpdateUserPasswordOptions {
  forceReset?: boolean
  expectedTokenVersion?: number
  auditContext?: PasswordAuditContext
}

/**
 * 更新用户密码
 * 包含：加密密码、更新密码修改时间
 * @param userId 用户ID
 * @param newPassword 新密码
 * @param options 密码更新选项，可用 tokenVersion 做并发条件更新
 */
export async function updateUserPassword(
  userId: number,
  newPassword: string,
  options: UpdateUserPasswordOptions = {}
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
        forcePasswordChange: options.forceReset ?? false,
        tokenVersion: sql`${users.tokenVersion} + 1`
      })
      .where(
        options.expectedTokenVersion === undefined
          ? eq(users.id, userId)
          : and(eq(users.id, userId), eq(users.tokenVersion, options.expectedTokenVersion))
      )
      .returning({
        passwordChangedAt: users.passwordChangedAt,
        tokenVersion: users.tokenVersion
      })

    const updatedUser = result[0]
    if (!updatedUser) {
      if (options.expectedTokenVersion !== undefined) {
        throw createApiError(409, 'AUTH_PASSWORD_STATE_CHANGED', '密码状态已变化，请重新验证后再试')
      }
      throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
    }

    return updatedUser
  })

  // 3. 审计日志在事务外写入，失败不影响密码修改主流程
  if (options.auditContext) {
    try {
      await db.insert(passwordAuditLogs).values({
        userId,
        actorId: options.auditContext.actorId ?? null,
        action: options.auditContext.action,
        success: true,
        ipAddress: options.auditContext.ipAddress,
        userAgent: options.auditContext.userAgent,
        failureReason: null
      })
    } catch (error) {
      console.error('[PasswordAudit] 写入密码审计日志失败:', error)
    }
  }

  return {
    passwordChangedAt: updated.passwordChangedAt || passwordChangedAt,
    tokenVersion: updated.tokenVersion
  }
}
