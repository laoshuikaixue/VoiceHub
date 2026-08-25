import assert from 'node:assert/strict'
import test from 'node:test'
import { getIdentityAvatarUrl, resolveAvatarSource } from '../../server/utils/user-avatar.ts'

test('getIdentityAvatarUrl 返回身份头像', () => {
  assert.equal(
    getIdentityAvatarUrl({
      provider: 'github',
      providerUserId: '1',
      avatar: 'https://example.com/a.png'
    }),
    'https://example.com/a.png'
  )
})

test('getIdentityAvatarUrl 拒绝非 http(s) 头像', () => {
  assert.equal(
    getIdentityAvatarUrl({
      provider: 'github',
      providerUserId: '1',
      avatar: 'javascript:alert(1)'
    }),
    null
  )
  assert.equal(
    getIdentityAvatarUrl({
      provider: 'qq',
      providerUserId: '1',
      avatar: 'data:image/png;base64,abc'
    }),
    null
  )
})

test('GitHub 存量身份无 avatar 时回退用户名图片', () => {
  assert.equal(
    getIdentityAvatarUrl({
      provider: 'github',
      providerUserId: '1',
      providerUsername: 'octocat',
      avatar: null
    }),
    'https://github.com/octocat.png'
  )
})

test('WebAuthn / TOTP 身份不参与头像', () => {
  assert.equal(
    getIdentityAvatarUrl({ provider: 'webauthn', providerUserId: 'x', avatar: null }),
    null
  )
  assert.equal(getIdentityAvatarUrl({ provider: 'totp', providerUserId: 'x', avatar: null }), null)
})

test('resolveAvatarSource 优先返回选中的身份', () => {
  const user = { avatarProvider: 'github', avatarProviderUserId: '2' }
  const identities = [
    {
      id: 1,
      provider: 'github',
      providerUserId: '1',
      providerUsername: 'a',
      avatar: 'https://a.png',
      createdAt: new Date('2024-01-01')
    },
    {
      id: 2,
      provider: 'github',
      providerUserId: '2',
      providerUsername: 'b',
      avatar: 'https://b.png',
      createdAt: new Date('2024-01-02')
    }
  ]
  assert.deepEqual(resolveAvatarSource(user, identities), {
    provider: 'github',
    providerUserId: '2',
    url: 'https://b.png'
  })
})

test('resolveAvatarSource 未选择时按创建顺序取第一个可用头像', () => {
  const identities = [
    {
      id: 2,
      provider: 'github',
      providerUserId: '2',
      providerUsername: 'b',
      avatar: 'https://b.png',
      createdAt: new Date('2024-01-02')
    },
    {
      id: 1,
      provider: 'qq',
      providerUserId: '1',
      providerUsername: 'a',
      avatar: 'https://a.png',
      createdAt: new Date('2024-01-01')
    }
  ]
  assert.deepEqual(resolveAvatarSource({}, identities), {
    provider: 'qq',
    providerUserId: '1',
    url: 'https://a.png'
  })
})

test('resolveAvatarSource 全部为空时返回 null', () => {
  assert.equal(
    resolveAvatarSource({}, [
      { provider: 'webauthn', providerUserId: 'x', avatar: null },
      { provider: 'totp', providerUserId: 'y', avatar: null }
    ]),
    null
  )
})

test('解绑回退：删除当前来源后取剩余身份第一个可用头像', () => {
  const user = { avatarProvider: 'qq', avatarProviderUserId: '1' }
  const remaining = [
    {
      id: 2,
      provider: 'github',
      providerUserId: '2',
      providerUsername: 'octocat',
      avatar: null,
      createdAt: new Date('2024-01-03')
    }
  ]
  assert.deepEqual(resolveAvatarSource(user, remaining), {
    provider: 'github',
    providerUserId: '2',
    url: 'https://github.com/octocat.png'
  })
})
