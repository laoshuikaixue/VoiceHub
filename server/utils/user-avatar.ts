// 头像来源解析：优先读取用户选中的身份，未选择时按创建顺序取第一个可用头像

export interface AvatarIdentity {
  id?: number
  provider: string
  providerUserId: string
  providerUsername?: string | null
  avatar?: string | null
  createdAt?: Date | string | number | null
}

export interface AvatarSource {
  provider: string
  providerUserId: string
  url: string
}

export function getIdentityAvatarUrl(
  identity: AvatarIdentity | null | undefined
): string | null {
  if (!identity) return null
  if (identity.provider === 'webauthn' || identity.provider === 'totp') return null

  const avatar = typeof identity.avatar === 'string' ? identity.avatar.trim() : ''
  if (avatar && /^https?:\/\//i.test(avatar)) return avatar

  // 兼容迁移前只存了 GitHub 用户名的身份（需校验格式，防止特殊字符拼进 URL）
  const username =
    typeof identity.providerUsername === 'string' ? identity.providerUsername.trim() : ''
  if (identity.provider === 'github' && username && /^[a-zA-Z0-9-]{1,39}$/.test(username)) {
    return `https://github.com/${username}.png`
  }

  return null
}

export function resolveAvatarSource(
  user: { avatarProvider?: string | null; avatarProviderUserId?: string | null },
  identities: AvatarIdentity[]
): AvatarSource | null {
  const candidates = identities
    .filter((identity) => getIdentityAvatarUrl(identity))
    .sort((a, b) => {
      const timeDiff = Number(new Date(a.createdAt || 0)) - Number(new Date(b.createdAt || 0))
      if (timeDiff !== 0) return timeDiff
      return (a.id ?? 0) - (b.id ?? 0)
    })

  if (candidates.length === 0) return null

  if (user?.avatarProvider && user?.avatarProviderUserId) {
    const selected = candidates.find(
      (identity) =>
        identity.provider === user.avatarProvider &&
        identity.providerUserId === user.avatarProviderUserId
    )
    if (selected) {
      return {
        provider: selected.provider,
        providerUserId: selected.providerUserId,
        url: getIdentityAvatarUrl(selected)!
      }
    }
  }

  const first = candidates[0]
  return {
    provider: first.provider,
    providerUserId: first.providerUserId,
    url: getIdentityAvatarUrl(first)!
  }
}
