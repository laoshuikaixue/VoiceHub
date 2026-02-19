import { generateState, getRedirectUri } from '~~/server/utils/oauth'
import { getOAuthStrategy } from '~~/server/utils/oauth-strategies'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!provider) {
    throw createError({ statusCode: 400, message: 'Missing provider' })
  }

  const strategy = getOAuthStrategy(provider)

  // 获取 Origin
  const headers = getRequestHeaders(event)
  const protocol = headers['x-forwarded-proto'] || 'http'
  const host = headers['host']
  const origin = `${protocol}://${host}`

  const redirectUri = getRedirectUri(provider)

  const { state, csrf } = generateState(origin, provider)

  setCookie(event, 'oauth_csrf', csrf, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10分钟
    path: '/'
  })

  const url = strategy.getAuthorizeUrl(redirectUri, state)

  return sendRedirect(event, url)
})
