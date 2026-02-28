import bcrypt from 'bcrypt'
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
): Promise<void> {
  // 1. 加密新密码
  const hashedNewPassword = await bcrypt.hash(newPassword, 12)

  // 2. 更新数据库
  await db
    .update(users)
    .set({
      password: hashedNewPassword,
      passwordChangedAt: forceReset ? null : getBeijingTime(),
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
}
