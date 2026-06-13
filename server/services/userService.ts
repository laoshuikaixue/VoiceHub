import bcrypt from 'bcryptjs'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { getBeijingTime } from '~/utils/timeUtils'

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
  forceReset: boolean = false
): Promise<{ passwordChangedAt: Date | string | null }> {
  // 1. 加密新密码
  const hashedNewPassword = await bcrypt.hash(newPassword, 12)

  // 2. 更新数据库
  // 即使是强制重置（forceReset=true），也必须将 passwordChangedAt 更新为当前时间：
  //   1) 使密码修改前签发的历史 JWT 立即失效（auth.ts 中按 iat < passwordChangedTime 拒绝）；
  //   2) 使 hasSetPassword 为 true，从而阻止他人借旧会话经 /api/auth/set-initial-password
  //      绕过临时密码直接重置，强制走 /api/auth/change-password 验证临时密码。
  // 强制改密的语义由 forcePasswordChange=forceReset 承载，且 resolveRequirePasswordChange 优先判断该标志。
  const passwordChangedAt = getBeijingTime()
  await db
    .update(users)
    .set({
      password: hashedNewPassword,
      passwordChangedAt,
      forcePasswordChange: forceReset
    })
    .where(eq(users.id, userId))

  // 3. 清除用户认证缓存
  try {
    const { userCache } = await import('~~/server/utils/cache-helpers')
    await userCache.clearAuth(String(userId))
    console.log(`[Cache] 用户认证缓存已清除（密码修改）: ${userId}`)
  } catch (cacheError) {
    console.warn('[Cache] 清除用户认证缓存失败:', cacheError)
  }

  return { passwordChangedAt }
}
