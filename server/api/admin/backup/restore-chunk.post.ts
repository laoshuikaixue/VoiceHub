import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  cardCodeRedeemLogs,
  cardCodes,
  emailTemplates,
  gradeClass,
  notificationSettings,
  notifications,
  playTimes,
  schedules,
  semesters,
  songBlacklists,
  songs,
  systemSettings,
  userIdentities,
  users,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { restoreScheduleSongPoolRecord } from '~~/server/utils/restoreScheduleSongPool'
import { omitMaskedSystemSettingsSecrets } from '~~/server/api/admin/system-settings/secretMask'
import { createApiError } from '~~/server/utils/apiError'
import { validateThemeConfig } from '~~/server/utils/theme-config'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { normalizeScheduleVisibilitySettings } from '~~/server/utils/system-settings-defaults'
import { syncAllSequences } from '~~/server/utils/sequence-sync'

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
    cardCodes: {}
  }

  const stats = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0,
    warnings: []
  }

  console.log(`处理批次: ${tableName}, ${records.length} 条记录`)

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
                'statusChangedBy',
                'remark',
                'avatarProvider',
                'avatarProviderUserId'
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
                } catch (error) {
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
              avatar: record.avatar || null,
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
              username: record.username ?? null,
              name: record.name ?? null,
              oldStatus: record.oldStatus || record.previousStatus || null,
              newStatus: record.newStatus,
              reason: record.reason || null,
              operatorId: record.operatorId || record.changedBy || null,
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
              played: record.hasOwnProperty('played') ? record.played : false
            }

            const songFields = [
              'title',
              'artist',
              'semester',
              'cover',
              'musicPlatform',
              'musicId',
              'durationSeconds',
              'submissionNote',
              'submissionNotePublic',
              'submissionNotePublicStatus'
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
                } catch (error) {
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

          case 'gradeClass': {
            const gradeClassData: any = {}
            const gradeClassFields = ['grade', 'class']
            gradeClassFields.forEach((field) => {
              if (record.hasOwnProperty(field)) {
                gradeClassData[field] =
                  typeof record[field] === 'string' ? record[field].trim() : record[field]
              }
            })
            // 空行直接跳过，避免空值配置行锁死配置优先校验
            if (!gradeClassData.grade || !gradeClassData.class) {
              stats.warnings.push(`gradeClass 记录 ${record.id ?? ''} 年级或班级为空，已跳过`)
              break
            }

            if (mode === 'merge') {
              const existingGradeClass = await tx.query.gradeClass.findFirst({
                where: and(
                  eq(gradeClass.grade, gradeClassData.grade),
                  eq(gradeClass.class, gradeClassData.class)
                )
              })
              if (!existingGradeClass) {
                await tx.insert(gradeClass).values(gradeClassData)
                stats.created++
              }
            } else {
              const existing = await tx.query.gradeClass.findFirst({
                where: eq(gradeClass.id, record.id)
              })
              if (!existing) {
                await tx.insert(gradeClass).values({ ...gradeClassData, id: record.id })
                stats.created++
              }
            }
            break
          }

          case 'systemSettings': {
            let systemSettingsData: any = {}
            const fields = [
              'enablePlayTimeSelection',
              'instanceId',
              'defaultTheme',
              'enabledThemes',
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
              'scheduleDaysBeforeEnabled',
              'scheduleDaysBefore',
              'scheduleDaysAfterEnabled',
              'scheduleDaysAfter',
              'showBlacklistKeywords',
              'hideStudentInfo',
              'enableReplayRequests',
              'enableCollaborativeSubmission',
              'enableSubmissionRemarks',
              'enableCardCodeRequests',
              'requireCardCodeForRequests',
              'enableCardCodeLimitBypass',
              'enableSubmissionRestriction',
              'submissionRestrictionScope',
              'sameSongRestrictionHours',
              'sameArtistRestrictionHours',
              'enableRequestTimeLimitation',
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
              'allowRegister',
              'registerRequiresApproval',
                'registerEmailRequired',
              'oauthRegisterRequiresApproval',
              'submissionNoteRequiresApproval',
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
            if (Object.prototype.hasOwnProperty.call(systemSettingsData, 'defaultTheme') || Object.prototype.hasOwnProperty.call(systemSettingsData, 'enabledThemes')) {
              if (!Object.prototype.hasOwnProperty.call(systemSettingsData, 'defaultTheme') || !Object.prototype.hasOwnProperty.call(systemSettingsData, 'enabledThemes')) {
                throw createApiError(400, SERVER_ERROR_CODES.THEME_INVALID_LIST, '主题配置必须同时包含默认主题和启用主题列表')
              }
              systemSettingsData.enabledThemes = JSON.stringify(validateThemeConfig(systemSettingsData.defaultTheme, systemSettingsData.enabledThemes))
            }
            for (const field of ['scheduleDaysBeforeEnabled', 'scheduleDaysAfterEnabled']) {
              if (Object.prototype.hasOwnProperty.call(systemSettingsData, field) && systemSettingsData[field] !== null && typeof systemSettingsData[field] !== 'boolean') {
                throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 必须是布尔值`)
              }
            }
            for (const field of ['scheduleDaysBefore', 'scheduleDaysAfter']) {
              if (Object.prototype.hasOwnProperty.call(systemSettingsData, field) && (systemSettingsData[field] !== null && (!Number.isInteger(systemSettingsData[field]) || systemSettingsData[field] < 1 || systemSettingsData[field] > 730))) {
                throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `${field} 必须是 1-730 的正整数`)
              }
            }
            systemSettingsData = normalizeScheduleVisibilitySettings(systemSettingsData)
            systemSettingsData = omitMaskedSystemSettingsSecrets(systemSettingsData)

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

          case 'emailTemplates': {
            // 邮件模板（按 key 去重：merge 模式同名 key 覆盖）
            if (!record.key || !record.name || !record.subject) return
            const templateData: any = {
              key: record.key,
              name: record.name,
              subject: record.subject,
              html: record.html || ''
            }
            if (record.contentType) templateData.contentType = record.contentType
            if (record.headerSubtitle) templateData.headerSubtitle = record.headerSubtitle
            if (record.actionText) templateData.actionText = record.actionText
            if (record.actionUrl) templateData.actionUrl = record.actionUrl
            if (record.updatedByUserId) templateData.updatedByUserId = record.updatedByUserId
            if (record.createdAt) templateData.createdAt = new Date(record.createdAt)
            if (record.updatedAt) templateData.updatedAt = new Date(record.updatedAt)

            if (mode === 'merge') {
              const existing = await tx.query.emailTemplates.findFirst({
                where: eq(emailTemplates.key, record.key)
              })
              if (existing) {
                await tx.update(emailTemplates).set(templateData).where(eq(emailTemplates.id, existing.id))
                stats.updated++
              } else {
                await tx.insert(emailTemplates).values(templateData)
                stats.created++
              }
            } else {
              const existing = await tx.query.emailTemplates.findFirst({
                where: eq(emailTemplates.id, record.id)
              })
              if (existing) {
                await tx.update(emailTemplates).set(templateData).where(eq(emailTemplates.id, record.id))
                stats.updated++
              } else {
                await tx.insert(emailTemplates).values({ ...templateData, id: record.id })
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

          case 'scheduleSongPool': {
            await restoreScheduleSongPoolRecord(tx, record, songIdMapping, userIdMapping, stats, () => { stats.created++ })
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

  // 防锁死：恢复系统设置块后校验 SMTP 已配置，否则剥离 registerEmailRequired
  // （避免恢复后注册必填邮箱却无法发码）
  if (tableName === 'systemSettings') {
    try {
      const restoredSettings = await db.select().from(systemSettings).limit(1)
      if (
        restoredSettings[0]?.registerEmailRequired &&
        (!restoredSettings[0]?.smtpEnabled || !restoredSettings[0]?.smtpHost)
      ) {
        await db
          .update(systemSettings)
          .set({ registerEmailRequired: false })
          .where(eq(systemSettings.id, restoredSettings[0].id))
        stats.warnings.push('SMTP 未配置，已剥离 registerEmailRequired，避免注册邮箱流程不可用')
      }
    } catch (settingsError) {
      console.error('恢复后设置一致性校验失败:', settingsError)
    }
  }

  // 恢复可能携带显式 id，完成后同步所有自增序列，避免后续插入主键冲突
  try {
    await syncAllSequences()
  } catch (seqError) {
    const seqErrorMsg = seqError instanceof Error ? seqError.message : '未知错误'
    stats.warnings.push(`自增序列同步失败: ${seqErrorMsg}`)
    console.error('自增序列同步失败:', seqError)
  }

  return {
    success: true,
    newMappings,
    stats
  }
})
