import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAvatarSource } from '../../server/utils/user-avatar.ts'

test('清除聚合登录绑定：准确识别聚合登录身份并排除其他提供商', () => {
  const identities = [
    { id: 1, userId: 101, provider: 'aggregate:qq', providerUserId: 'qq_123' },
    { id: 2, userId: 101, provider: 'aggregate:wx', providerUserId: 'wx_456' },
    { id: 3, userId: 101, provider: 'github', providerUserId: 'gh_789' },
    { id: 4, userId: 102, provider: 'aggregate', providerUserId: 'agg_999' },
    { id: 5, userId: 102, provider: 'casdoor', providerUserId: 'cas_888' },
    { id: 6, userId: 103, provider: 'google', providerUserId: 'goog_777' }
  ]

  const isAggregate = (provider: string) => provider === 'aggregate' || provider.startsWith('aggregate:')

  const targetIdentities = identities.filter((i) => isAggregate(i.provider))
  const remainingIdentities = identities.filter((i) => !isAggregate(i.provider))

  assert.equal(targetIdentities.length, 3)
  assert.deepEqual(
    targetIdentities.map((i) => i.id),
    [1, 2, 4]
  )

  const affectedUserIds = Array.from(new Set(targetIdentities.map((i) => i.userId)))
  assert.deepEqual(affectedUserIds, [101, 102])

  assert.equal(remainingIdentities.length, 3)
  assert.deepEqual(
    remainingIdentities.map((i) => i.id),
    [3, 5, 6]
  )
})

test('清除聚合登录绑定：当用户头像来源为聚合登录且拥有其他第三方身份时，正确回退头像', () => {
  const user = {
    id: 101,
    avatarProvider: 'aggregate:qq',
    avatarProviderUserId: 'qq_123'
  }

  const allUserIdentities = [
    {
      id: 1,
      userId: 101,
      provider: 'aggregate:qq',
      providerUserId: 'qq_123',
      avatar: 'https://example.com/qq.png',
      createdAt: new Date('2024-01-01')
    },
    {
      id: 2,
      userId: 101,
      provider: 'github',
      providerUserId: 'gh_789',
      avatar: 'https://example.com/gh.png',
      createdAt: new Date('2024-01-02')
    }
  ]

  const targetKeys = new Set(['aggregate:qq:qq_123'])
  const remainingIdentities = allUserIdentities.filter(
    (i) => !targetKeys.has(`${i.provider}:${i.providerUserId}`)
  )

  const isAvatarSourceDeleted =
    user.avatarProvider &&
    (user.avatarProvider === 'aggregate' ||
      user.avatarProvider.startsWith('aggregate:') ||
      targetKeys.has(`${user.avatarProvider}:${user.avatarProviderUserId}`))

  assert.equal(isAvatarSourceDeleted, true)

  const fallback = resolveAvatarSource(user, remainingIdentities)
  assert.deepEqual(fallback, {
    provider: 'github',
    providerUserId: 'gh_789',
    url: 'https://example.com/gh.png'
  })
})

test('清除聚合登录绑定：当用户头像来源为聚合登录且无其他第三方身份时，头像源置为 null', () => {
  const user = {
    id: 102,
    avatarProvider: 'aggregate',
    avatarProviderUserId: 'agg_999'
  }

  const allUserIdentities = [
    {
      id: 4,
      userId: 102,
      provider: 'aggregate',
      providerUserId: 'agg_999',
      avatar: 'https://example.com/agg.png',
      createdAt: new Date('2024-01-01')
    }
  ]

  const targetKeys = new Set(['aggregate:agg_999'])
  const remainingIdentities = allUserIdentities.filter(
    (i) => !targetKeys.has(`${i.provider}:${i.providerUserId}`)
  )

  const fallback = resolveAvatarSource(user, remainingIdentities)
  assert.equal(fallback, null)
})
