import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  apiKeyPermissions,
  apiKeys,
  apiLogs,
  cardCodeRedeemLogs,
  cardCodes,
  collaborationLogs,
  emailTemplates,
  notificationSettings,
  notifications,
  playTimes,
  requestTimes,
  schedules,
  semesters,
  songBlacklists,
  songCollaborators,
  songReplayRequests,
  songQuotaAccounts,
  songQuotaTransactions,
  songs,
  systemSettings,
  userIdentities,
  users,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || user.role !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      message: '只有超级管理员可以恢复备份'
    })
  }

  const body = await readBody(event)
  const {
    tableName,
    records,
    mappings,
    mode = 'merge',
    overwriteSuperAdmin = false,
    hasSuperAdminInBackup = false
  } = body

  if (overwriteSuperAdmin && user.role !== 'SUPER_ADMIN') {
    throw createError({
      statusCode: 403,
      message: '仅超级管理员可以覆盖超级管理员账号数据'
    })
  }

  if (!tableName || !records || !Array.isArray(records)) {
    throw createError({
      statusCode: 400,
      message: '无效的请求参数'
    })
  }

  // 转换映射对象为Map
  const userIdMapping = new Map(
    Object.entries(mappings?.users || {}).map(([k, v]) => [Number(k), Number(v)])
  )
  const songIdMapping = new Map(
    Object.entries(mappings?.songs || {}).map(([k, v]) => [Number(k), Number(v)])
  )
  const cardCodeIdMapping = new Map(
    Object.entries(mappings?.cardCodes || {}).map(([k, v]) => [Number(k), Number(v)])
  )
  const quotaAccountIdMapping = new Map(
    Object.entries(mappings?.quotaAccounts || {}).map(([k, v]) => [Number(k), Number(v)])
  )
  const quotaTransactionIdMapping = new Map(
    Object.entries(mappings?.quotaTransactions || {}).map(([k, v]) => [Number(k), Number(v)])
  )
  const apiKeyIdMapping = new Map(Object.entries(mappings?.apiKeys || {}))
  const collaboratorIdMapping = new Map(Object.entries(mappings?.collaborators || {}))
  const preservedSuperAdminIds = new Set(
    (mappings?.meta?.preservedSuperAdminIds || []).map((id) => Number(id))
  )
  const temporaryPreservedUserId = mappings?.meta?.temporaryPreservedUserId
    ? Number(mappings.meta.temporaryPreservedUserId)
    : null
  const shouldOverwriteSuperAdmin = overwriteSuperAdmin && hasSuperAdminInBackup

  const newMappings = {
    users: {},
    songs: {},
    cardCodes: {},
    quotaAccounts: {},
    quotaTransactions: {},
    apiKeys: {},
    collaborators: {}
  }

  const stats = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
    warnings: []
  }

  console.log(`处理批次: ${tableName}, ${records.length} 条记录`)

  const validateQuotaSnapshots = async () => {
    await db.transaction(async (tx) => {
      for (const record of records) {
        if (!record.quotaConsumed) continue
        const mappedSongId = songIdMapping.get(record.id)
        const quotaTransactionId = quotaTransactionIdMapping.get(record.quotaTransactionId)
        const quotaReturnTransactionId = record.quotaReturned
          ? quotaTransactionIdMapping.get(record.quotaReturnTransactionId)
          : null
        if (!mappedSongId || !quotaTransactionId)
          throw new Error(`歌曲 ${record.id} 额度快照一致性校验失败`)
        const consumed = await tx.query.songQuotaTransactions.findFirst({
          where: eq(songQuotaTransactions.id, quotaTransactionId)
        })
        const returned = quotaReturnTransactionId
          ? await tx.query.songQuotaTransactions.findFirst({
              where: eq(songQuotaTransactions.id, quotaReturnTransactionId)
            })
          : null
        const consumptionValid =
          consumed?.source === 'SONG_REQUEST' &&
          consumed.delta < 0 &&
          consumed.songId === mappedSongId &&
          consumed.quotaType === record.quotaType
        const returnValid =
          !record.quotaReturned ||
          (returned &&
            ((returned.source === 'SONG_WITHDRAW_RETURN' && returned.delta > 0) ||
              (returned.source === 'SONG_WITHDRAW_EXPIRED' && returned.delta === 0)) &&
            returned.songId === mappedSongId &&
            returned.quotaType === record.quotaType)
        if (!consumptionValid || !returnValid)
          throw new Error(`歌曲 ${record.id} 额度快照一致性校验失败`)
      }
    })
  }

  if (tableName === 'songQuotaSnapshotsPreflight') {
    await validateQuotaSnapshots()
    return {
      success: true,
      message: '额度快照预检完成',
      newMappings,
      stats
    }
  }

  for (const record of records) {
    try {
      await db.transaction(async (tx) => {
        switch (tableName) {
          case 'users': {
            const buildUserData = (includePassword = false) => {
              const userData: any = {}
              const userFields = [
                'username',
                'name',
                'grade',
                'class',
                'role',
                'email',
                'emailVerified',
                'lastLoginIp',
                'meowNickname',
                'forcePasswordChange',
                'status',
                'statusChangedBy'
              ]
              const dateFields = [
                'createdAt',
                'updatedAt',
                'lastLogin',
                'passwordChangedAt',
                'meowBoundAt',
                'statusChangedAt'
              ]

              userFields.forEach((field) => {
                if (record.hasOwnProperty(field)) {
                  if (field === 'role') {
                    if (!['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(record[field])) {
                      userData[field] = 'USER'
                    } else {
                      userData[field] = record[field]
                    }
                  } else {
                    userData[field] = record[field]
                  }
                }
              })

              dateFields.forEach((field) => {
                if (record.hasOwnProperty(field) && record[field]) {
                  userData[field] = new Date(record[field])
                } else if (record.hasOwnProperty(field)) {
                  userData[field] = null
                }
              })

              if (includePassword && record.hasOwnProperty('password')) {
                userData.password = record.password
              }

              return userData
            }

            let createdUser
            if (mode === 'merge') {
              const existingUser = await tx.query.users.findFirst({
                where: eq(users.username, record.username)
              })

              if (existingUser) {
                createdUser = (
                  await tx
                    .update(users)
                    .set(buildUserData(false))
                    .where(eq(users.username, record.username))
                    .returning()
                )[0]
                stats.updated++
              } else {
                try {
                  const existingUserWithId = await tx.query.users.findFirst({
                    where: eq(users.id, record.id)
                  })

                  if (existingUserWithId) {
                    createdUser = (
                      await tx.insert(users).values(buildUserData(true)).returning()
                    )[0]
                  } else {
                    createdUser = (
                      await tx
                        .insert(users)
                        .values({
                          ...buildUserData(true),
                          id: record.id
                        })
                        .returning()
                    )[0]
                  }
                } catch {
                  console.warn(`用户 ${record.username} 使用原始ID创建失败，使用自动生成ID`)
                  createdUser = (await tx.insert(users).values(buildUserData(true)).returning())[0]
                }
                stats.created++
              }
            } else {
              if (
                shouldOverwriteSuperAdmin &&
                temporaryPreservedUserId &&
                Number(record.id) === temporaryPreservedUserId
              ) {
                createdUser = (await tx.insert(users).values(buildUserData(true)).returning())[0]
                stats.created++
                if (record.id && createdUser?.id) {
                  newMappings.users[record.id] = createdUser.id
                }
                break
              }

              const isBackupSuperAdminRecord =
                record.role === 'SUPER_ADMIN' || preservedSuperAdminIds.has(Number(record.id))
              if (!shouldOverwriteSuperAdmin && isBackupSuperAdminRecord) {
                if (record.id) {
                  const existingUserWithId = await tx.query.users.findFirst({
                    where: eq(users.id, record.id)
                  })
                  if (existingUserWithId) {
                    newMappings.users[record.id] = existingUserWithId.id
                  }
                }
                stats.updated++
                break
              }

              const existingUserWithId = await tx.query.users.findFirst({
                where: eq(users.id, record.id)
              })

              if (existingUserWithId) {
                createdUser = (
                  await tx
                    .update(users)
                    .set(buildUserData(true))
                    .where(eq(users.id, record.id))
                    .returning()
                )[0]
                stats.updated++
              } else {
                createdUser = (
                  await tx
                    .insert(users)
                    .values({
                      ...buildUserData(true),
                      id: record.id
                    })
                    .returning()
                )[0]
                stats.created++
              }
            }

            if (record.id && createdUser.id) {
              newMappings.users[record.id] = createdUser.id
            }
            break
          }

          case 'userIdentities': {
            let validIdentityUserId = record.userId
            if (record.userId) {
              const mappedUserId = userIdMapping.get(record.userId)
              if (mappedUserId) {
                validIdentityUserId = mappedUserId
              } else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.userId)
                })
                if (!userExists) {
                  console.warn(`身份关联记录的用户ID ${record.userId} 不存在，跳过`)
                  return
                }
              }
            } else {
              return
            }

            const identityData = {
              userId: validIdentityUserId,
              provider: record.provider,
              providerUserId: record.providerUserId,
              providerUsername: record.providerUsername,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }

            if (
              !shouldOverwriteSuperAdmin &&
              preservedSuperAdminIds.has(Number(validIdentityUserId))
            ) {
              stats.updated++
              break
            }

            if (mode === 'merge') {
              await tx
                .insert(userIdentities)
                .values(identityData)
                .onConflictDoUpdate({
                  target: [userIdentities.provider, userIdentities.providerUserId],
                  set: identityData
                })
              stats.updated++
            } else if (record.id) {
              const existingIdentityWithId = await tx.query.userIdentities.findFirst({
                where: eq(userIdentities.id, record.id)
              })

              if (existingIdentityWithId) {
                await tx
                  .update(userIdentities)
                  .set(identityData)
                  .where(eq(userIdentities.id, record.id))
                stats.updated++
              } else {
                await tx.insert(userIdentities).values({
                  ...identityData,
                  id: record.id
                })
                stats.created++
              }
            } else {
              await tx.insert(userIdentities).values(identityData)
              stats.created++
            }
            break
          }

          case 'userStatusLogs': {
            let validUserId = record.userId
            if (record.userId) {
              const mappedUserId = userIdMapping.get(record.userId)
              if (mappedUserId) {
                validUserId = mappedUserId
              } else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.userId)
                })
                if (!userExists) {
                  console.warn(`用户状态日志的用户ID ${record.userId} 不存在，跳过`)
                  return
                }
              }
            } else {
              return
            }

            const userStatusLogData = {
              userId: validUserId,
              previousStatus: record.previousStatus || null,
              newStatus: record.newStatus,
              reason: record.reason || null,
              changedBy: record.changedBy || null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }

            if (mode === 'merge') {
              await tx.insert(userStatusLogs).values(userStatusLogData)
              stats.created++
            } else {
              if (record.id) {
                const existingLog = await tx.query.userStatusLogs.findFirst({
                  where: eq(userStatusLogs.id, record.id)
                })

                if (existingLog) {
                  await tx
                    .update(userStatusLogs)
                    .set(userStatusLogData)
                    .where(eq(userStatusLogs.id, record.id))
                  stats.updated++
                } else {
                  await tx.insert(userStatusLogs).values({
                    ...userStatusLogData,
                    id: record.id
                  })
                  stats.created++
                }
              } else {
                await tx.insert(userStatusLogs).values(userStatusLogData)
                stats.created++
              }
            }
            break
          }

          case 'cardCodes': {
            const cardCodeData: any = {}
            const cardCodeFields = ['code', 'status', 'note']
            cardCodeFields.forEach((field) => {
              if (record.hasOwnProperty(field)) {
                cardCodeData[field] = record[field]
              }
            })

            if (!cardCodeData.code) return

            const mapUserId = async (field: 'lockedBy' | 'redeemedBy') => {
              if (!record[field]) return null
              const mappedUserId = userIdMapping.get(record[field])
              if (mappedUserId) return mappedUserId
              if (mode === 'merge') return null
              const userExists = await tx.query.users.findFirst({
                where: eq(users.id, record[field])
              })
              return userExists ? record[field] : null
            }

            cardCodeData.lockedBy = await mapUserId('lockedBy')
            cardCodeData.redeemedBy = await mapUserId('redeemedBy')
            cardCodeData.lockedAt = record.lockedAt ? new Date(record.lockedAt) : null
            cardCodeData.redeemedAt = record.redeemedAt ? new Date(record.redeemedAt) : null
            cardCodeData.createdAt = record.createdAt ? new Date(record.createdAt) : new Date()
            cardCodeData.updatedAt = record.updatedAt ? new Date(record.updatedAt) : new Date()

            let restoredCardCode
            if (mode === 'merge') {
              const existing = await tx.query.cardCodes.findFirst({
                where: eq(cardCodes.code, cardCodeData.code)
              })
              if (existing) {
                restoredCardCode = (
                  await tx
                    .update(cardCodes)
                    .set(cardCodeData)
                    .where(eq(cardCodes.id, existing.id))
                    .returning()
                )[0]
                stats.updated++
              } else {
                restoredCardCode = (await tx.insert(cardCodes).values(cardCodeData).returning())[0]
                stats.created++
              }
            } else {
              const existing = await tx.query.cardCodes.findFirst({
                where: eq(cardCodes.id, record.id)
              })
              if (existing) {
                restoredCardCode = (
                  await tx
                    .update(cardCodes)
                    .set(cardCodeData)
                    .where(eq(cardCodes.id, record.id))
                    .returning()
                )[0]
                stats.updated++
              } else {
                restoredCardCode = (
                  await tx
                    .insert(cardCodes)
                    .values({ ...cardCodeData, id: record.id })
                    .returning()
                )[0]
                stats.created++
              }
            }

            if (record.id && restoredCardCode?.id) {
              newMappings.cardCodes[record.id] = restoredCardCode.id
            }
            break
          }

          case 'songQuotaAccounts': {
            const mappedUserId = userIdMapping.get(record.userId) || record.userId
            const userExists = await tx.query.users.findFirst({
              where: eq(users.id, mappedUserId)
            })
            if (!userExists) return
            const accountData: any = {
              userId: mappedUserId,
              periodicBalance: record.periodicBalance ?? 0,
              permanentBalance: record.permanentBalance ?? 0,
              periodKey: record.periodKey || null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
            }
            const existing = await tx.query.songQuotaAccounts.findFirst({
              where: eq(songQuotaAccounts.userId, mappedUserId)
            })
            const restored = existing
              ? (
                  await tx
                    .update(songQuotaAccounts)
                    .set(accountData)
                    .where(eq(songQuotaAccounts.id, existing.id))
                    .returning()
                )[0]
              : (
                  await tx
                    .insert(songQuotaAccounts)
                    .values(
                      mode === 'replace' && record.id
                        ? { ...accountData, id: record.id }
                        : accountData
                    )
                    .returning()
                )[0]
            if (existing) stats.updated++
            else stats.created++
            if (record.id && restored?.id) newMappings.quotaAccounts[record.id] = restored.id
            break
          }

          case 'songs': {
            let validRequesterId = record.requesterId
            let validPreferredPlayTimeId = record.preferredPlayTimeId

            if (record.requesterId) {
              const mappedUserId = userIdMapping.get(record.requesterId)
              if (mappedUserId) {
                validRequesterId = mappedUserId
              } else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.requesterId)
                })
                if (!userExists) {
                  console.warn(`歌曲请求者ID ${record.requesterId} 不存在，跳过`)
                  return
                }
              }
            } else {
              return
            }

            if (record.preferredPlayTimeId) {
              const playTimeExists = await tx.query.playTimes.findFirst({
                where: eq(playTimes.id, record.preferredPlayTimeId)
              })
              if (!playTimeExists) {
                validPreferredPlayTimeId = null
              }
            }

            let validCardCodeId = record.cardCodeId || null
            if (record.cardCodeId) {
              const mappedCardCodeId = cardCodeIdMapping.get(record.cardCodeId)
              if (mappedCardCodeId) {
                validCardCodeId = mappedCardCodeId
              } else {
                const cardCodeExists = await tx.query.cardCodes.findFirst({
                  where: eq(cardCodes.id, record.cardCodeId)
                })
                if (!cardCodeExists) {
                  validCardCodeId = null
                }
              }
            }

            const songData: any = {
              requesterId: validRequesterId,
              preferredPlayTimeId: validPreferredPlayTimeId,
              cardCodeId: validCardCodeId,
              played: record.hasOwnProperty('played') ? record.played : false,
              quotaConsumed: false,
              quotaType: null,
              quotaTransactionId: null,
              quotaPeriodKey: null,
              quotaReturned: false,
              quotaReturnTransactionId: null
            }

            const songFields = [
              'title',
              'artist',
              'semester',
              'cover',
              'musicPlatform',
              'musicId',
              'requestId',
              'fingerprint',
              'submissionNote',
              'submissionNotePublic'
            ]
            songFields.forEach((field) => {
              if (record.hasOwnProperty(field)) {
                songData[field] = record[field]
              }
            })

            if (record.playedAt) songData.playedAt = new Date(record.playedAt)
            else songData.playedAt = null

            if (record.createdAt) songData.createdAt = new Date(record.createdAt)
            else songData.createdAt = new Date()

            if (record.updatedAt) songData.updatedAt = new Date(record.updatedAt)
            else songData.updatedAt = new Date()

            let createdSong
            if (mode === 'merge') {
              const existingSong = await tx.query.songs.findFirst({
                where: and(eq(songs.title, record.title), eq(songs.artist, record.artist))
              })

              if (existingSong) {
                createdSong = (
                  await tx
                    .update(songs)
                    .set(songData)
                    .where(eq(songs.id, existingSong.id))
                    .returning()
                )[0]
                stats.updated++
              } else {
                try {
                  const existingSongWithId = await tx.query.songs.findFirst({
                    where: eq(songs.id, record.id)
                  })

                  if (existingSongWithId) {
                    createdSong = (await tx.insert(songs).values(songData).returning())[0]
                  } else {
                    createdSong = (
                      await tx
                        .insert(songs)
                        .values({
                          ...songData,
                          id: record.id
                        })
                        .returning()
                    )[0]
                  }
                } catch {
                  createdSong = (await tx.insert(songs).values(songData).returning())[0]
                }
                stats.created++
              }
            } else {
              const existingSongWithId = await tx.query.songs.findFirst({
                where: eq(songs.id, record.id)
              })

              if (existingSongWithId) {
                createdSong = (
                  await tx.update(songs).set(songData).where(eq(songs.id, record.id)).returning()
                )[0]
                stats.updated++
              } else {
                createdSong = (
                  await tx
                    .insert(songs)
                    .values({
                      ...songData,
                      id: record.id
                    })
                    .returning()
                )[0]
                stats.created++
              }
            }

            if (record.id && createdSong.id) {
              newMappings.songs[record.id] = createdSong.id
            }
            break
          }

          case 'songQuotaTransactions': {
            const mappedAccountId = quotaAccountIdMapping.get(record.accountId) || record.accountId
            const accountExists = await tx.query.songQuotaAccounts.findFirst({
              where: eq(songQuotaAccounts.id, mappedAccountId)
            })
            if (!accountExists) return
            const transactionData: any = {
              accountId: mappedAccountId,
              quotaType: record.quotaType,
              source: record.source,
              delta: record.delta,
              balanceAfter: record.balanceAfter,
              periodKey: record.periodKey || null,
              idempotencyKey: record.idempotencyKey || null,
              requestFingerprint: record.requestFingerprint || null,
              songId: record.songId ? songIdMapping.get(record.songId) || null : null,
              legacyCardId: record.legacyCardId
                ? cardCodeIdMapping.get(record.legacyCardId) || null
                : null,
              administratorId: record.administratorId
                ? userIdMapping.get(record.administratorId) || null
                : null,
              apiKeyId: apiKeyIdMapping.get(record.apiKeyId) || null,
              publicDescription: record.publicDescription || null,
              internalNote: record.internalNote || null,
              externalReference: record.externalReference || null,
              snapshot: record.snapshot || null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }
            const existing = record.idempotencyKey
              ? await tx.query.songQuotaTransactions.findFirst({
                  where: eq(songQuotaTransactions.idempotencyKey, record.idempotencyKey)
                })
              : null
            const restored = existing
              ? (
                  await tx
                    .update(songQuotaTransactions)
                    .set(transactionData)
                    .where(eq(songQuotaTransactions.id, existing.id))
                    .returning()
                )[0]
              : (
                  await tx
                    .insert(songQuotaTransactions)
                    .values(
                      mode === 'replace' && record.id
                        ? { ...transactionData, id: record.id }
                        : transactionData
                    )
                    .returning()
                )[0]
            if (existing) stats.updated++
            else stats.created++
            if (record.id && restored?.id) newMappings.quotaTransactions[record.id] = restored.id
            break
          }

          case 'songQuotaSnapshots': {
            if (!record.quotaConsumed) break
            const mappedSongId = songIdMapping.get(record.id)
            const quotaTransactionId = quotaTransactionIdMapping.get(record.quotaTransactionId)
            const quotaReturnTransactionId = record.quotaReturned
              ? quotaTransactionIdMapping.get(record.quotaReturnTransactionId)
              : null
            if (!mappedSongId || !quotaTransactionId)
              throw new Error(`歌曲 ${record.id} 额度快照一致性校验失败`)
            const consumed = await tx.query.songQuotaTransactions.findFirst({
              where: eq(songQuotaTransactions.id, quotaTransactionId)
            })
            const returned = quotaReturnTransactionId
              ? await tx.query.songQuotaTransactions.findFirst({
                  where: eq(songQuotaTransactions.id, quotaReturnTransactionId)
                })
              : null
            const consumptionValid =
              consumed?.source === 'SONG_REQUEST' &&
              consumed.delta < 0 &&
              consumed.songId === mappedSongId &&
              consumed.quotaType === record.quotaType
            const returnValid =
              !record.quotaReturned ||
              (returned &&
                ((returned.source === 'SONG_WITHDRAW_RETURN' && returned.delta > 0) ||
                  (returned.source === 'SONG_WITHDRAW_EXPIRED' && returned.delta === 0)) &&
                returned.songId === mappedSongId &&
                returned.quotaType === record.quotaType)
            if (!consumptionValid || !returnValid)
              throw new Error(`歌曲 ${record.id} 额度快照一致性校验失败`)
            await tx
              .update(songs)
              .set({
                quotaConsumed: true,
                quotaType: record.quotaType,
                quotaTransactionId,
                quotaPeriodKey: record.quotaPeriodKey || null,
                quotaReturned: record.quotaReturned === true,
                quotaReturnTransactionId
              })
              .where(eq(songs.id, mappedSongId))
            stats.updated++
            break
          }

          case 'playTimes': {
            const playTimeData: any = {}
            const playTimeFields = ['name', 'startTime', 'endTime', 'description']
            playTimeFields.forEach((field) => {
              if (record.hasOwnProperty(field)) {
                playTimeData[field] = record[field]
              }
            })
            playTimeData.enabled = record.hasOwnProperty('enabled') ? record.enabled : true

            if (mode === 'merge') {
              const existingPlayTime = await tx.query.playTimes.findFirst({
                where: eq(playTimes.name, record.name)
              })

              if (existingPlayTime) {
                await tx
                  .update(playTimes)
                  .set(playTimeData)
                  .where(eq(playTimes.id, existingPlayTime.id))
                stats.updated++
              } else {
                await tx.insert(playTimes).values(playTimeData)
                stats.created++
              }
            } else {
              const existingPlayTimeWithId = await tx.query.playTimes.findFirst({
                where: eq(playTimes.id, record.id)
              })

              if (existingPlayTimeWithId) {
                await tx.update(playTimes).set(playTimeData).where(eq(playTimes.id, record.id))
                stats.updated++
              } else {
                await tx.insert(playTimes).values({
                  ...playTimeData,
                  id: record.id
                })
                stats.created++
              }
            }
            break
          }

          case 'semesters': {
            const semesterData: any = {}
            const semesterFields = ['name']
            semesterFields.forEach((field) => {
              if (record.hasOwnProperty(field)) {
                semesterData[field] = record[field]
              }
            })
            semesterData.isActive = record.hasOwnProperty('isActive') ? record.isActive : false
            if (record.createdAt) semesterData.createdAt = new Date(record.createdAt)

            if (mode === 'merge') {
              const existingSemester = await tx.query.semesters.findFirst({
                where: eq(semesters.name, semesterData.name)
              })
              if (existingSemester) {
                await tx
                  .update(semesters)
                  .set(semesterData)
                  .where(eq(semesters.id, existingSemester.id))
                stats.updated++
              } else {
                await tx.insert(semesters).values(semesterData)
                stats.created++
              }
            } else {
              const existing = await tx.query.semesters.findFirst({
                where: eq(semesters.id, record.id)
              })
              if (existing) {
                await tx.update(semesters).set(semesterData).where(eq(semesters.id, record.id))
                stats.updated++
              } else {
                await tx.insert(semesters).values({ ...semesterData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'systemSettings': {
            const systemSettingsData: any = {}
            const fields = [
              'enablePlayTimeSelection',
              'instanceId',
              'telemetryEnabled',
              'siteTitle',
              'siteLogoUrl',
              'schoolLogoHomeUrl',
              'schoolLogoPrintUrl',
              'siteDescription',
              'submissionGuidelines',
              'icpNumber',
              'gonganNumber',
              'enableSubmissionLimit',
              'dailySubmissionLimit',
              'weeklySubmissionLimit',
              'monthlySubmissionLimit',
              'showBlacklistKeywords',
              'hideStudentInfo',
              'enableReplayRequests',
              'enableCollaborativeSubmission',
              'enableSubmissionRemarks',
              'enableCardCodeRequests',
              'requireCardCodeForRequests',
              'enableCardCodeLimitBypass',
              'songQuotaEnabled',
              'songQuotaPeriodType',
              'songQuotaPeriodAmount',
              'adminSongQuotaExempt',
              'blockOnSongQuotaInsufficient',
              'legacyCardConversionEnabled',
              'enableRequestTimeLimitation',
              'requestTimeLimitation',
              'forceBlockAllRequests',
              'forcePasswordChangeOnFirstLogin',
              'smtpEnabled',
              'smtpHost',
              'smtpPort',
              'smtpSecure',
              'smtpUsername',
              'smtpPassword',
              'smtpFromEmail',
              'smtpFromName',
              'allowOAuthRegistration',
              'oauthRedirectUri',
              'oauthStateSecret',
              'oauthProviders',
              'githubOAuthEnabled',
              'githubClientId',
              'githubClientSecret',
              'casdoorOAuthEnabled',
              'casdoorServerUrl',
              'casdoorClientId',
              'casdoorClientSecret',
              'casdoorOrganizationName',
              'googleOAuthEnabled',
              'googleClientId',
              'googleClientSecret',
              'aggregateOAuthEnabled',
              'aggregateOAuthAppId',
              'aggregateOAuthAppKey',
              'aggregateOAuthLoginType',
              'aggregateOAuthEndpoint',
              'customOAuthEnabled',
              'customOAuthDisplayName',
              'customOAuthAuthorizeUrl',
              'customOAuthTokenUrl',
              'customOAuthUserInfoUrl',
              'customOAuthScope',
              'customOAuthClientId',
              'customOAuthClientSecret',
              'customOAuthUserIdField',
              'customOAuthUsernameField',
              'customOAuthNameField',
              'customOAuthEmailField',
              'customOAuthAvatarField',
              'captchaEnabled',
              'captchaMaxFailures',
              'captchaProvider',
              'turnstileSiteKey',
              'turnstileSecretKey',
              'autoBackupEnabled',
              'autoBackupConfig',
              'enabledPlatforms',
              'platformOrder'
            ]
            fields.forEach((field) => {
              if (record.hasOwnProperty(field)) systemSettingsData[field] = record[field]
            })

            if (mode === 'merge') {
              const existing = await tx.query.systemSettings.findFirst()
              if (existing) {
                await tx
                  .update(systemSettings)
                  .set(systemSettingsData)
                  .where(eq(systemSettings.id, existing.id))
                stats.updated++
              } else {
                await tx.insert(systemSettings).values(systemSettingsData)
                stats.created++
              }
            } else {
              const existing = await tx.query.systemSettings.findFirst({
                where: eq(systemSettings.id, record.id)
              })
              if (existing) {
                await tx
                  .update(systemSettings)
                  .set(systemSettingsData)
                  .where(eq(systemSettings.id, record.id))
                stats.updated++
              } else {
                await tx.insert(systemSettings).values({ ...systemSettingsData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'schedules': {
            if (!record.songId || !record.playDate) return

            let validSongId = record.songId
            const mappedSongId = songIdMapping.get(record.songId)
            if (mappedSongId) {
              validSongId = mappedSongId
            } else {
              const songExists = await tx.query.songs.findFirst({
                where: eq(songs.id, record.songId)
              })
              if (!songExists) return
            }

            let validPlayTimeId = record.playTimeId
            if (record.playTimeId) {
              const ptExists = await tx.query.playTimes.findFirst({
                where: eq(playTimes.id, record.playTimeId)
              })
              if (!ptExists) validPlayTimeId = null
            }

            const scheduleData: any = {
              songId: validSongId,
              playDate: new Date(record.playDate),
              playTimeId: validPlayTimeId,
              played: record.hasOwnProperty('played') ? record.played : false,
              sequence: record.hasOwnProperty('sequence') ? record.sequence : 1
            }
            if (record.publishedAt) scheduleData.publishedAt = new Date(record.publishedAt)
            if (record.isDraft !== undefined) scheduleData.isDraft = record.isDraft

            if (mode === 'merge') {
              const existing = await tx.query.schedules.findFirst({
                where: and(
                  eq(schedules.songId, validSongId),
                  eq(schedules.playDate, scheduleData.playDate)
                )
              })
              if (existing) {
                await tx.update(schedules).set(scheduleData).where(eq(schedules.id, existing.id))
                stats.updated++
              } else {
                await tx.insert(schedules).values(scheduleData)
                stats.created++
              }
            } else {
              const existing = await tx.query.schedules.findFirst({
                where: eq(schedules.id, record.id)
              })
              if (existing) {
                await tx.update(schedules).set(scheduleData).where(eq(schedules.id, record.id))
                stats.updated++
              } else {
                await tx.insert(schedules).values({ ...scheduleData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'notificationSettings': {
            let validUserId = record.userId
            if (record.userId) {
              const mappedUserId = userIdMapping.get(record.userId)
              if (mappedUserId) validUserId = mappedUserId
              else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.userId)
                })
                if (!userExists) return
              }
            }

            const notificationSettingsData: any = { userId: validUserId }
            const fields = ['refreshInterval', 'songVotedThreshold', 'meowUserId']
            fields.forEach((field) => {
              if (record.hasOwnProperty(field)) notificationSettingsData[field] = record[field]
            })
            notificationSettingsData.enabled = record.hasOwnProperty('enabled')
              ? record.enabled
              : true
            notificationSettingsData.songRequestEnabled = record.hasOwnProperty(
              'songRequestEnabled'
            )
              ? record.songRequestEnabled
              : true
            notificationSettingsData.songVotedEnabled = record.hasOwnProperty('songVotedEnabled')
              ? record.songVotedEnabled
              : true
            notificationSettingsData.songPlayedEnabled = record.hasOwnProperty('songPlayedEnabled')
              ? record.songPlayedEnabled
              : true

            if (!notificationSettingsData.refreshInterval)
              notificationSettingsData.refreshInterval = 60
            if (!notificationSettingsData.songVotedThreshold)
              notificationSettingsData.songVotedThreshold = 1

            notificationSettingsData.createdAt = record.createdAt
              ? new Date(record.createdAt)
              : new Date()
            notificationSettingsData.updatedAt = record.updatedAt
              ? new Date(record.updatedAt)
              : new Date()

            if (mode === 'merge') {
              const existing = await tx.query.notificationSettings.findFirst({
                where: eq(notificationSettings.userId, validUserId)
              })
              if (existing) {
                await tx
                  .update(notificationSettings)
                  .set(notificationSettingsData)
                  .where(eq(notificationSettings.id, existing.id))
                stats.updated++
              } else {
                await tx.insert(notificationSettings).values(notificationSettingsData)
                stats.created++
              }
            } else {
              const existing = await tx.query.notificationSettings.findFirst({
                where: eq(notificationSettings.id, record.id)
              })
              if (existing) {
                await tx
                  .update(notificationSettings)
                  .set(notificationSettingsData)
                  .where(eq(notificationSettings.id, record.id))
                stats.updated++
              } else {
                await tx
                  .insert(notificationSettings)
                  .values({ ...notificationSettingsData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'notifications': {
            let validUserId = record.userId
            if (record.userId) {
              const mappedUserId = userIdMapping.get(record.userId)
              if (mappedUserId) validUserId = mappedUserId
              else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.userId)
                })
                if (!userExists) return
              }
            }

            const notificationData: any = { userId: validUserId }
            const fields = [
              'batchId',
              'source',
              'senderName',
              'senderUsername',
              'title',
              'message',
              'type',
              'userDeleted'
            ]
            fields.forEach((field) => {
              if (record.hasOwnProperty(field)) notificationData[field] = record[field]
            })
            // senderId 需要重新映射到目标库的用户 ID；映射未命中时回查同 ID 用户并比对用户名快照，
            // 不一致则置空，避免跨库恢复时将发送人归属到错误用户，展示仍靠快照字段
            if (Object.prototype.hasOwnProperty.call(record, 'senderId')) {
              if (record.senderId) {
                const mappedSenderId = userIdMapping.get(record.senderId)
                if (mappedSenderId) {
                  notificationData.senderId = mappedSenderId
                } else {
                  const senderExists = await tx.query.users.findFirst({
                    where: eq(users.id, record.senderId)
                  })
                  notificationData.senderId =
                    senderExists && senderExists.username === record.senderUsername
                      ? record.senderId
                      : null
                }
              } else {
                notificationData.senderId = null
              }
            }
            notificationData.read = record.hasOwnProperty('read') ? record.read : false
            notificationData.important = Object.prototype.hasOwnProperty.call(record, 'important')
              ? record.important
              : false
            notificationData.createdAt = record.createdAt ? new Date(record.createdAt) : new Date()
            notificationData.updatedAt = record.updatedAt ? new Date(record.updatedAt) : new Date()

            if (mode === 'merge') {
              const existing = await tx.query.notifications.findFirst({
                where: and(
                  eq(notifications.userId, validUserId),
                  eq(notifications.type, record.type),
                  eq(notifications.message, record.message)
                )
              })
              if (existing) {
                await tx
                  .update(notifications)
                  .set(notificationData)
                  .where(eq(notifications.id, existing.id))
                stats.updated++
              } else {
                await tx.insert(notifications).values(notificationData)
                stats.created++
              }
            } else {
              const existing = await tx.query.notifications.findFirst({
                where: eq(notifications.id, record.id)
              })
              if (existing) {
                await tx
                  .update(notifications)
                  .set(notificationData)
                  .where(eq(notifications.id, record.id))
                stats.updated++
              } else {
                await tx.insert(notifications).values({ ...notificationData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'songBlacklist': {
            let validCreatedBy = record.createdBy
            if (record.createdBy) {
              const mappedUserId = userIdMapping.get(record.createdBy)
              if (mappedUserId) validCreatedBy = mappedUserId
              else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.createdBy)
                })
                if (!userExists) validCreatedBy = null
              }
            }

            const blacklistData: any = {
              type: record.type || 'KEYWORD',
              value: record.value || '',
              reason: record.reason || null,
              isActive: record.hasOwnProperty('isActive') ? record.isActive : true,
              createdBy: validCreatedBy,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
            }

            if (mode === 'merge') {
              const existing = await tx.query.songBlacklists.findFirst({
                where: and(
                  eq(songBlacklists.type, blacklistData.type),
                  eq(songBlacklists.value, blacklistData.value)
                )
              })
              if (existing) {
                await tx
                  .update(songBlacklists)
                  .set(blacklistData)
                  .where(eq(songBlacklists.id, existing.id))
                stats.updated++
              } else {
                await tx.insert(songBlacklists).values(blacklistData)
                stats.created++
              }
            } else {
              const existing = await tx.query.songBlacklists.findFirst({
                where: eq(songBlacklists.id, record.id)
              })
              if (existing) {
                await tx
                  .update(songBlacklists)
                  .set(blacklistData)
                  .where(eq(songBlacklists.id, record.id))
                stats.updated++
              } else {
                await tx.insert(songBlacklists).values({ ...blacklistData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'cardCodeRedeemLogs': {
            let validCardCodeId = record.cardCodeId || null
            if (record.cardCodeId) {
              const mappedCardCodeId = cardCodeIdMapping.get(record.cardCodeId)
              if (mappedCardCodeId) {
                validCardCodeId = mappedCardCodeId
              } else {
                const cardCodeExists = await tx.query.cardCodes.findFirst({
                  where: eq(cardCodes.id, record.cardCodeId)
                })
                if (!cardCodeExists) validCardCodeId = null
              }
            }

            let validRedeemedBy = record.redeemedBy
            if (record.redeemedBy) {
              const mappedUserId = userIdMapping.get(record.redeemedBy)
              if (mappedUserId) {
                validRedeemedBy = mappedUserId
              } else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.redeemedBy)
                })
                if (!userExists) return
              }
            } else return

            let validSongId = record.songId || null
            if (record.songId) {
              const mappedSongId = songIdMapping.get(record.songId)
              if (mappedSongId) {
                validSongId = mappedSongId
              } else {
                const songExists = await tx.query.songs.findFirst({
                  where: eq(songs.id, record.songId)
                })
                if (!songExists) validSongId = null
              }
            }

            const logData: any = {
              cardCodeId: validCardCodeId,
              codeSnapshot: record.codeSnapshot,
              redeemedBy: validRedeemedBy,
              redeemedAt: record.redeemedAt ? new Date(record.redeemedAt) : new Date(),
              source: record.source || 'UNKNOWN',
              songId: validSongId,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }

            if (!logData.codeSnapshot) return

            if (mode === 'merge') {
              await tx.insert(cardCodeRedeemLogs).values(logData)
              stats.created++
            } else {
              const existing = await tx.query.cardCodeRedeemLogs.findFirst({
                where: eq(cardCodeRedeemLogs.id, record.id)
              })
              if (existing) {
                await tx
                  .update(cardCodeRedeemLogs)
                  .set(logData)
                  .where(eq(cardCodeRedeemLogs.id, record.id))
                stats.updated++
              } else {
                await tx.insert(cardCodeRedeemLogs).values({ ...logData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'requestTimes': {
            const data: any = {
              name: record.name,
              startTime: record.startTime ? new Date(record.startTime) : null,
              endTime: record.endTime ? new Date(record.endTime) : null,
              enabled: record.enabled !== false,
              description: record.description || null,
              expected: record.expected || 0,
              accepted: record.accepted || 0,
              past: record.past === true,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
            }
            const existing = await tx.query.requestTimes.findFirst({
              where: eq(requestTimes.name, record.name)
            })
            if (existing) {
              await tx.update(requestTimes).set(data).where(eq(requestTimes.id, existing.id))
              stats.updated++
            } else {
              await tx
                .insert(requestTimes)
                .values(mode === 'replace' && record.id ? { ...data, id: record.id } : data)
              stats.created++
            }
            break
          }

          case 'songCollaborators': {
            const data: any = {
              id: record.id,
              songId: songIdMapping.get(record.songId) || record.songId,
              userId: userIdMapping.get(record.userId) || record.userId,
              status: record.status || 'PENDING',
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
            }
            const restored = (
              await tx
                .insert(songCollaborators)
                .values(data)
                .onConflictDoUpdate({ target: songCollaborators.id, set: data })
                .returning()
            )[0]
            if (record.id && restored?.id) newMappings.collaborators[record.id] = restored.id
            stats.created++
            break
          }

          case 'collaborationLogs': {
            const data: any = {
              id: record.id,
              collaboratorId:
                collaboratorIdMapping.get(record.collaboratorId) || record.collaboratorId,
              action: record.action,
              operatorId: userIdMapping.get(record.operatorId) || record.operatorId,
              ipAddress: record.ipAddress || null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }
            await tx
              .insert(collaborationLogs)
              .values(data)
              .onConflictDoUpdate({ target: collaborationLogs.id, set: data })
            stats.created++
            break
          }

          case 'songReplayRequests': {
            const data: any = {
              songId: songIdMapping.get(record.songId) || record.songId,
              userId: userIdMapping.get(record.userId) || record.userId,
              status: record.status || 'PENDING',
              preferredPlayTimeId: record.preferredPlayTimeId || null,
              submissionNote: record.submissionNote || null,
              submissionNotePublic: record.submissionNotePublic === true,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
            }
            await tx
              .insert(songReplayRequests)
              .values(mode === 'replace' && record.id ? { ...data, id: record.id } : data)
              .onConflictDoNothing()
            stats.created++
            break
          }

          case 'emailTemplates': {
            const data: any = {
              key: record.key,
              name: record.name,
              subject: record.subject,
              html: record.html,
              updatedByUserId: record.updatedByUserId
                ? userIdMapping.get(record.updatedByUserId) || null
                : null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
            }
            const existing = await tx.query.emailTemplates.findFirst({
              where: eq(emailTemplates.key, record.key)
            })
            if (existing) {
              await tx.update(emailTemplates).set(data).where(eq(emailTemplates.id, existing.id))
              stats.updated++
            } else {
              await tx
                .insert(emailTemplates)
                .values(mode === 'replace' && record.id ? { ...data, id: record.id } : data)
              stats.created++
            }
            break
          }

          case 'apiKeys': {
            const data: any = {
              name: record.name,
              description: record.description || null,
              keyHash: record.keyHash,
              keyPrefix: record.keyPrefix,
              isActive: record.isActive !== false,
              expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
              lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
              createdByUserId: userIdMapping.get(record.createdByUserId) || record.createdByUserId,
              usageCount: record.usageCount || 0
            }
            const existing = await tx.query.apiKeys.findFirst({
              where: eq(apiKeys.keyHash, record.keyHash)
            })
            const restored = existing
              ? (
                  await tx.update(apiKeys).set(data).where(eq(apiKeys.id, existing.id)).returning()
                )[0]
              : (
                  await tx
                    .insert(apiKeys)
                    .values(mode === 'replace' && record.id ? { ...data, id: record.id } : data)
                    .returning()
                )[0]
            if (existing) stats.updated++
            else stats.created++
            if (record.id && restored?.id) newMappings.apiKeys[record.id] = restored.id
            break
          }

          case 'apiKeyPermissions': {
            const data: any = {
              apiKeyId: apiKeyIdMapping.get(record.apiKeyId) || record.apiKeyId,
              permission: record.permission,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }
            await tx
              .insert(apiKeyPermissions)
              .values(mode === 'replace' && record.id ? { ...data, id: record.id } : data)
              .onConflictDoNothing()
            stats.created++
            break
          }

          case 'apiLogs': {
            const data: any = {
              apiKeyId: apiKeyIdMapping.get(record.apiKeyId) || record.apiKeyId || null,
              endpoint: record.endpoint,
              method: record.method,
              ipAddress: record.ipAddress,
              userAgent: record.userAgent || null,
              statusCode: record.statusCode,
              responseTimeMs: record.responseTimeMs,
              requestBody: record.requestBody || null,
              responseBody: record.responseBody || null,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
              errorMessage: record.errorMessage || null
            }
            await tx
              .insert(apiLogs)
              .values(mode === 'replace' && record.id ? { ...data, id: record.id } : data)
              .onConflictDoNothing()
            stats.created++
            break
          }

          case 'votes': {
            let validUserId = record.userId
            if (record.userId) {
              const mappedUserId = userIdMapping.get(record.userId)
              if (mappedUserId) validUserId = mappedUserId
              else {
                const userExists = await tx.query.users.findFirst({
                  where: eq(users.id, record.userId)
                })
                if (!userExists) return
              }
            } else return

            let validSongId = record.songId
            if (record.songId) {
              const mappedSongId = songIdMapping.get(record.songId)
              if (mappedSongId) validSongId = mappedSongId
              else {
                const songExists = await tx.query.songs.findFirst({
                  where: eq(songs.id, record.songId)
                })
                if (!songExists) return
              }
            } else return

            const voteData: any = {
              userId: validUserId,
              songId: validSongId,
              createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }

            // 对于投票，merge和replace模式下都需要检查重复，因为联合主键或唯一约束
            const existing = await tx.query.votes.findFirst({
              where: and(eq(votes.userId, validUserId), eq(votes.songId, validSongId))
            })

            if (existing) {
              await tx.update(votes).set(voteData).where(eq(votes.id, existing.id))
              stats.updated++
            } else {
              await tx.insert(votes).values(voteData)
              stats.created++
            }
            break
          }
        }
      })
      stats.processed++
    } catch (error) {
      console.error(`处理记录失败 (${tableName}):`, error)
      stats.errors++
      stats.warnings.push(`记录处理失败: ${error.message}`)
    }
  }

  return {
    success: stats.errors === 0,
    message: stats.errors === 0 ? '分块恢复完成' : '分块恢复存在一致性错误',
    newMappings,
    stats
  }
})
