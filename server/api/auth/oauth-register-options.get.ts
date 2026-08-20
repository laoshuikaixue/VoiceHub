import { db } from '~/drizzle/db'
import { verifyBindingToken } from '~~/server/utils/oauth-token'
import { createApiError } from '~~/server/utils/apiError'
import { fetchGradeClassOptions } from '~~/server/utils/grade-class-options'

export default defineEventHandler(async (event) => {
  const config = await db.query.systemSettings.findFirst()
  if (!config?.allowOAuthRegistration) {
    throw createApiError(403, 'AUTH_OAUTH_REGISTER_DISABLED', '系统已关闭第三方账号注册功能')
  }

  const bindingToken = getCookie(event, 'binding-token')
  if (!bindingToken) {
    throw createApiError(401, 'AUTH_REGISTER_SESSION_EXPIRED', '注册会话已过期，请重新通过第三方登录发起')
  }

  try {
    verifyBindingToken(bindingToken)
  } catch {
    deleteCookie(event, 'binding-token')
    throw createApiError(401, 'AUTH_INVALID_REGISTER_TOKEN', '无效的注册令牌')
  }

  const classes = await fetchGradeClassOptions()

  return {
    success: true,
    classes
  }
})
