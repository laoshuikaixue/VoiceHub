import { db, userIdentities, eq, and, users } from '~/drizzle/db'
import { JWTEnhanced } from '~~/server/utils/jwt-enhanced'
import { createApiError } from '~~/server/utils/apiError'

/**
 * 查询当前处于「待二次验证」状态的登录信息。
 *
 * 用途：OAuth 登录回调在检测到账号已启用 TOTP 时，不会直接下发 auth-token，
 * 而是签发 pre-auth 临时令牌并跳转到本页面，由前端读取本接口展示验证方式，
 * 用户完成 TOTP/邮箱验证码校验后由 /api/auth/2fa/verify 正式签发会话。
 *
 * 信息来源仅为 httpOnly 的 pre-auth-token Cookie，服务端验签后解析，
 * 因此本接口不会泄漏任何超出该令牌持有者的信息。
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'pre-auth-token')
  if (!token) {
    throw createApiError(400, 'AUTH_MISSING_PRE_TOKEN_RELOGIN', '缺少预认证令牌，请重新登录')
  }

  let userId: number
  let preAuthPayload: { tokenVersion?: unknown } | null = null
  try {
    const decoded = JWTEnhanced.verify(token) as any
    if (decoded.type !== 'pre-auth' || decoded.scope !== '2fa_pending') {
      throw new Error('无效的预认证令牌')
    }
    userId = decoded.userId
    preAuthPayload = decoded
  } catch {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      status: users.status,
      tokenVersion: users.tokenVersion
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(404, 'USER_NOT_FOUND', '用户不存在')
  }

  if (!JWTEnhanced.hasCurrentTokenVersion(preAuthPayload, user.tokenVersion)) {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(401, 'AUTH_SESSION_EXPIRED', '会话已失效，请重新登录')
  }

  if (user.status !== 'active') {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(403, 'AUTH_ACCOUNT_DISABLED_OR_RESTRICTED', '账号已被禁用或限制访问')
  }

  const totpIdentity = await db.query.userIdentities.findFirst({
    where: and(eq(userIdentities.userId, userId), eq(userIdentities.provider, 'totp'))
  })

  if (!totpIdentity) {
    deleteCookie(event, 'pre-auth-token')
    throw createApiError(400, 'AUTH_TOTP_NOT_ENABLED', '未开启TOTP验证')
  }

  const methods = ['totp']
  let maskedEmail = ''
  if (user.email && user.emailVerified) {
    methods.push('email')
    const [local, domain] = user.email.split('@')
    if (local && domain) {
      maskedEmail = local.length <= 2 ? `***@${domain}` : `${local.slice(0, 2)}****@${domain}`
    }
  }

  return {
    userId: user.id,
    methods,
    maskedEmail
  }
})
