import { getCookie, deleteCookie } from 'h3'
import { db, users, eq } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { createApiError } from '~~/server/utils/apiError'
import { build2FAChallenge } from '~~/server/utils/two-factor-challenge'

// OAuth 回调重定向到 /login?action=2fa 后，前端凭 httpOnly 的 pre-auth-token 拉取待验证信息。
// 令牌本身只在服务端校验，不返回给浏览器。
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'pre-auth-token')
  if (!token) {
    throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
  }

  let decoded: any
  try {
    decoded = JWTEnhanced.verify(token)
    if (decoded.type !== 'pre-auth' || decoded.scope !== '2fa_pending') {
      throw new Error('无效的预认证令牌')
    }
  } catch {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
  }

  const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)
  if (!user) {
    throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
  }

  if (!JWTEnhanced.hasCurrentTokenVersion(decoded, user.tokenVersion)) {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
  }

  if (user.status !== 'active') {
    throw createApiError(403, 'AUTH_ACCOUNT_DISABLED_OR_RESTRICTED', '账号已被禁用或限制访问')
  }

  const { methods, maskedEmail } = build2FAChallenge(user)
  return { success: true, userId: user.id, methods, maskedEmail }
})
