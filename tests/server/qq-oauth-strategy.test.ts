import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getOAuthStrategy } from '../../server/utils/oauth-strategies.ts'

test('QQ OAuth uses Tencent authorization endpoint with standard state and callback', async () => {
  const url = new URL(
    await getOAuthStrategy('qq').getAuthorizeUrl(
      'https://voicehub.example.com/api/auth/qq/callback',
      'safe-state',
      { clientId: '12345' }
    )
  )
  assert.equal(url.origin + url.pathname, 'https://graph.qq.com/oauth2.0/authorize')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), '12345')
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'https://voicehub.example.com/api/auth/qq/callback'
  )
  assert.equal(url.searchParams.get('state'), 'safe-state')
  assert.equal(url.searchParams.get('scope'), 'get_user_info')
})

test('QQ OAuth is registered as an independent provider, not aggregate QQ', async () => {
  const { isSupportedOAuthProvider } = await import('../../server/utils/oauth-providers.ts')
  assert.equal(isSupportedOAuthProvider('qq'), true)
})

test('QQ code exchange uses GET query parameters and parses fmt=json access token', async (context) => {
  const previousFetch = (globalThis as any).$fetch
  const calls = []
  ;(globalThis as any).$fetch = async (url, options) => {
    calls.push({ url, options })
    return JSON.stringify({ access_token: 'token-1' })
  }
  context.after(() => {
    ;(globalThis as any).$fetch = previousFetch
  })

  const token = await getOAuthStrategy('qq').exchangeToken(
    'auth-code',
    'https://voicehub.example.com/api/auth/qq/callback',
    { clientId: '12345', clientSecret: 'app-key' }
  )

  assert.equal(token, 'token-1')
  const request = new URL(calls[0].url)
  assert.equal(request.origin + request.pathname, 'https://graph.qq.com/oauth2.0/token')
  assert.equal(request.searchParams.get('grant_type'), 'authorization_code')
  assert.equal(request.searchParams.get('client_id'), '12345')
  assert.equal(request.searchParams.get('client_secret'), 'app-key')
  assert.equal(request.searchParams.get('code'), 'auth-code')
  assert.equal(
    request.searchParams.get('redirect_uri'),
    'https://voicehub.example.com/api/auth/qq/callback'
  )
  assert.equal(request.searchParams.get('fmt'), 'json')
  assert.equal(request.searchParams.get('need_openid'), '1')
  assert.equal(calls[0].options.responseType, 'text')
})

test('QQ user info resolves the JSON OpenID and calls the documented profile API', async (context) => {
  const previousFetch = (globalThis as any).$fetch
  const calls = []
  ;(globalThis as any).$fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/oauth2.0/me'))
      return JSON.stringify({ client_id: '12345', openid: 'openid-1' })
    return { ret: 0, nickname: 'tester', figureurl_qq_1: 'https://avatar.example/40.png' }
  }
  context.after(() => {
    ;(globalThis as any).$fetch = previousFetch
  })

  const profile = await getOAuthStrategy('qq').getUserInfo('token-1', {
    clientId: '12345',
    clientSecret: 'app-key'
  })

  assert.deepEqual(profile, {
    id: 'openid-1',
    username: 'tester',
    name: 'tester',
    avatar: 'https://avatar.example/40.png'
  })
  assert.equal(calls[0].options.query.fmt, 'json')
  assert.equal(calls[1].url, 'https://graph.qq.com/user/get_user_info')
  assert.equal(calls[1].options.query.oauth_consumer_key, '12345')
  assert.equal(calls[1].options.query.openid, 'openid-1')
})

test('QQ user info rejects OpenID belonging to another app', async (context) => {
  const previousFetch = (globalThis as any).$fetch
  ;(globalThis as any).$fetch = async () =>
    JSON.stringify({ client_id: 'other-app', openid: 'openid-1' })
  context.after(() => {
    ;(globalThis as any).$fetch = previousFetch
  })

  await assert.rejects(
    getOAuthStrategy('qq').getUserInfo('token-1', { clientId: '12345', clientSecret: 'app-key' }),
    /OpenID 无效/
  )
})
