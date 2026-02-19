import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  notificationSettings,
  notifications,
  playTimes,
  schedules,
  semesters,
  songBlacklists,
  songs,
  systemSettings,
  users,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: '权限不足'
    })
  }

  const body = await readBody(event)
  const { tableName, records, mappings, mode = 'merge' } = body

  if (!tableName || !records || !Array.isArray(records)) {
    throw createError({
      statusCode: 400,
      statusMessage: '无效的请求参数'
    })
  }

  // 转换映射对象为Map
  const userIdMapping = new Map(
    Object.entries(mappings?.users || {}).map(([k, v]) => [Number(k), Number(v)])
  )
  const songIdMapping = new Map(
    Object.entries(mappings?.songs || {}).map(([k, v]) => [Number(k), Number(v)])
  )

  const newMappings = {
    users: {},
    songs: {}
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
                'lastLoginIp',
                'meowNickname',
                'forcePasswordChange'
              ]
              const dateFields = ['lastLogin', 'passwordChangedAt', 'meowBoundAt']

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
              const existingUserWithId = await tx.query.users.findFirst({
                where: eq(users.id, record.id)
              })

              if (existingUserWithId) {
                createdUser = (
                  await tx
                    .update(users)
                    .set(buildUserData(false))
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

            const songData: any = {
              requesterId: validRequesterId,
              preferredPlayTimeId: validPreferredPlayTimeId,
              played: record.hasOwnProperty('played') ? record.played : false
            }

            const songFields = ['title', 'artist', 'semester', 'cover', 'musicPlatform', 'musicId']
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

          case 'systemSettings': {
            const systemSettingsData: any = {}
            const fields = [
              'enablePlayTimeSelection',
              'siteTitle',
              'siteLogoUrl',
              'schoolLogoHomeUrl',
              'schoolLogoPrintUrl',
              'siteDescription',
              'submissionGuidelines',
              'icpNumber',
              'enableSubmissionLimit',
              'dailySubmissionLimit',
              'weeklySubmissionLimit',
              'showBlacklistKeywords',
              'hideStudentInfo'
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
            const fields = ['title', 'message', 'type']
            fields.forEach((field) => {
              if (record.hasOwnProperty(field)) notificationData[field] = record[field]
            })
            notificationData.read = record.hasOwnProperty('read') ? record.read : false
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
    success: true,
    newMappings,
    stats
  }
})
