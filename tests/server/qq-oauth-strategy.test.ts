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
})

test('QQ OAuth is registered as an independent provider, not aggregate QQ', async () => {
  const { isSupportedOAuthProvider } = await import('../../server/utils/oauth-providers.ts')
  assert.equal(isSupportedOAuthProvider('qq'), true)
})
