import { db, eq, userIdentities, users } from '~/drizzle/db'
import { getBeijingTime } from '~/utils/timeUtils'
import { resolveAvatarSource } from '~~/server/utils/user-avatar'

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface OAuthIdentityPayload {
  provider: string
  providerUserId: string
  providerUsername?: string | null
  avatar?: string | null
}

export interface ExistingOAuthIdentity {
  id: number
  avatar: string | null
}

// 统一 OAuth 身份绑定后的头像写入与自动补选，避免多段绑定流程逻辑漂移
export async function syncOAuthIdentityAvatar(
  tx: DbTransaction,
  user: { id: number; avatarProvider?: string | null; avatarProviderUserId?: string | null },
  existing: ExistingOAuthIdentity | null | undefined,
  payload: OAuthIdentityPayload
): Promise<{ created: boolean; avatarSourceSet: boolean }> {
  const currentIdentities = await tx.query.userIdentities.findMany({
    where: (t, { eq: eqUserId }) => eqUserId(t.userId, user.id),
    columns: {
      id: true,
      provider: true,
      providerUserId: true,
      providerUsername: true,
      avatar: true,
      createdAt: true
    }
  })
  const currentAvatarSource = resolveAvatarSource(user, currentIdentities)

  let created = false
  if (existing) {
    if (payload.avatar && existing.avatar !== payload.avatar) {
      await tx
        .update(userIdentities)
        .set({ avatar: payload.avatar })
        .where(eq(userIdentities.id, existing.id))
    }
  } else {
    await tx.insert(userIdentities).values({
      userId: user.id,
      provider: payload.provider,
      providerUserId: payload.providerUserId,
      providerUsername: payload.providerUsername,
      avatar: payload.avatar || null,
      createdAt: getBeijingTime()
    })
    created = true
  }

  let avatarSourceSet = false
  if (!currentAvatarSource) {
    const updatedIdentities = await tx.query.userIdentities.findMany({
      where: (t, { eq: eqUserId }) => eqUserId(t.userId, user.id),
      columns: {
        id: true,
        provider: true,
        providerUserId: true,
        providerUsername: true,
        avatar: true,
        createdAt: true
      }
    })
    const nextAvatarSource = resolveAvatarSource(user, updatedIdentities)
    if (nextAvatarSource) {
      await tx
        .update(users)
        .set({
          avatarProvider: nextAvatarSource.provider,
          avatarProviderUserId: nextAvatarSource.providerUserId
        })
        .where(eq(users.id, user.id))
      avatarSourceSet = true
    }
  }

  return { created, avatarSourceSet }
}
