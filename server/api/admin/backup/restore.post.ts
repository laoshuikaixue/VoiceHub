import { createError, defineEventHandler, readBody, readMultipartFormData } from 'h3'
import { db } from '~/drizzle/db'
import {
  apiKeyPermissions,
  apiKeys,
  apiLogs,
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
  songs,
  systemSettings,
  userIdentities,
  users,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { promises as fs } from 'fs'
import path from 'path'
import { CacheService } from '../../../services/cacheService'
import { and, eq, ne } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    // 验证管理员权限
    const user = event.context.user
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: '权限不足'
      })
    }

    let backupData
    let mode = 'merge'
    let clearExisting = false

    // 检查是否是文件上传
    const contentType = event.node.req.headers['content-type']

    if (contentType && contentType.includes('multipart/form-data')) {
      // 处理文件上传
      const formData = await readMultipartFormData(event)

      if (!formData) {
        throw createError({
          statusCode: 400,
          statusMessage: '请上传备份文件'
        })
      }

      let fileData = null
      for (const field of formData) {
        if (field.name === 'file' && field.data) {
          fileData = field.data.toString('utf8')
        } else if (field.name === 'mode' && field.data) {
          mode = field.data.toString()
        } else if (field.name === 'clearExisting' && field.data) {
          clearExisting = field.data.toString() === 'true'
        }
      }

      if (!fileData) {
        throw createError({
          statusCode: 400,
          statusMessage: '请上传备份文件'
        })
      }

      try {
        backupData = JSON.parse(fileData)
      } catch (error) {
        throw createError({
          statusCode: 400,
          statusMessage: '备份文件格式错误'
        })
      }

      console.log(`开始恢复上传的数据库备份`)
    } else {
      // 处理传统的文件名方式（向后兼容）
      const body = await readBody(event)
      const { filename, mode: bodyMode = 'merge', clearExisting: bodyClearExisting = false } = body

      if (!filename) {
        throw createError({
          statusCode: 400,
          statusMessage: '请指定备份文件名或上传备份文件'
        })
      }

      mode = bodyMode
      clearExisting = bodyClearExisting

      console.log(`开始恢复数据库备份: ${filename}`)

      // 读取备份文件
      const backupDir = path.join(process.cwd(), 'backups')
      const filepath = path.join(backupDir, filename)

      try {
        const fileContent = await fs.readFile(filepath, 'utf8')
        backupData = JSON.parse(fileContent)
      } catch (error) {
        throw createError({
          statusCode: 404,
          statusMessage: '备份文件不存在或格式错误'
        })
      }
    }

    // 验证备份文件格式
    if (!backupData.metadata || !backupData.data) {
      throw createError({
        statusCode: 400,
        statusMessage: '备份文件格式无效'
      })
    }

    console.log(`备份文件信息:`)
    console.log(`- 版本: ${backupData.metadata.version}`)
    console.log(`- 创建时间: ${backupData.metadata.timestamp}`)
    console.log(`- 创建者: ${backupData.metadata.creator}`)
    console.log(`- 总记录数: ${backupData.metadata.totalRecords}`)

    const restoreResults = {
      success: true,
      message: '数据恢复完成',
      details: {
        tablesProcessed: 0,
        recordsRestored: 0,
        errors: [],
        warnings: []
      }
    }

    // 如果需要清空现有数据
    if (clearExisting) {
      console.log('清空现有数据...')
      try {
        // 按照外键依赖顺序删除数据
        await db.delete(apiLogs)
        await db.delete(apiKeyPermissions)
        await db.delete(apiKeys)
        await db.delete(notifications)
        await db.delete(notificationSettings)
        await db.delete(collaborationLogs)
        await db.delete(songCollaborators)
        await db.delete(songReplayRequests)
        await db.delete(schedules)
        await db.delete(votes)
        await db.delete(songs)
        await db.delete(songBlacklists)
        await db.delete(userStatusLogs)
        await db.delete(emailTemplates)
        await db.delete(userIdentities)
        await db.delete(users).where(ne(users.role, 'SUPER_ADMIN'))
        await db.delete(playTimes)
        await db.delete(semesters)
        await db.delete(requestTimes)
        await db.delete(systemSettings)
        console.log('✅ 现有数据已清空')
      } catch (error) {
        console.error('清空数据失败:', error)
        restoreResults.details.warnings.push(`清空数据失败: ${error.message}`)
      }
    }

    // 建立ID映射表
    const userIdMapping = new Map() // 备份ID -> 当前数据库ID
    const songIdMapping = new Map() // 备份ID -> 当前数据库ID

    // 定义恢复顺序（考虑外键依赖）
    const restoreOrder = [
      'systemSettings',
      'playTimes',
      'semesters',
      'requestTimes',
      'users',
      'userIdentities',
      'emailTemplates',
      'userStatusLogs',
      'songBlacklist',
      'songs',
      'songCollaborators',
      'collaborationLogs',
      'songReplayRequests',
      'votes',
      'schedules',
      'notificationSettings',
      'notifications',
      'apiKeys',
      'apiKeyPermissions',
      'apiLogs'
    ]

    // 按预定义顺序恢复数据，每个表使用独立事务
    for (const tableName of restoreOrder) {
      if (!backupData.data[tableName] || !Array.isArray(backupData.data[tableName])) {
        continue
      }

      const tableData = backupData.data[tableName]

      console.log(`恢复表: ${tableName} (${tableData.length} 条记录)`)

      try {
        let restoredCount = 0

        // 分批处理大量数据，每条记录使用独立事务
        let batchSize = 10 // 初始批次大小
        let consecutiveErrors = 0

        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize)

          // 逐条处理记录，每条记录使用独立事务，带重试机制
          for (const record of batch) {
            let retryCount = 0
            const maxRetries = 3
            let lastError = null

            while (retryCount <= maxRetries) {
              try {
                await db.$transaction(
                  async (tx) => {
                    // 根据表名选择恢复策略
                    switch (tableName) {
                      case 'users':
                        // 动态构建用户数据，自动跳过不存在的字段
                        const buildUserData = (includePassword = false) => {
                          const userData = {}
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

                          // 处理日期字段
                          const dateFields = ['lastLogin', 'passwordChangedAt', 'meowBoundAt']

                          // 添加基本字段
                          userFields.forEach((field) => {
                            if (record.hasOwnProperty(field)) {
                              // 确保角色为有效的硬编码角色
                              if (field === 'role') {
                                if (
                                  !['USER', 'SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(
                                    record[field]
                                  )
                                ) {
                                  userData[field] = 'USER' // 默认为普通用户
                                } else {
                                  userData[field] = record[field]
                                }
                              } else {
                                userData[field] = record[field]
                              }
                            }
                          })

                          // 处理日期字段
                          dateFields.forEach((field) => {
                            if (record.hasOwnProperty(field) && record[field]) {
                              userData[field] = new Date(record[field])
                            } else if (record.hasOwnProperty(field)) {
                              userData[field] = null
                            }
                          })

                          // 密码字段只在创建时需要
                          if (includePassword && record.hasOwnProperty('password')) {
                            userData.password = record.password
                          }

                          return userData
                        }

                        let createdUser
                        if (mode === 'merge') {
                          // 在merge模式下，先检查用户名是否存在
                          const existingUser = await tx
                            .select()
                            .from(users)
                            .where(eq(users.username, record.username))
                            .limit(1)

                          if (existingUser.length > 0) {
                            // 如果用户名已存在，更新现有用户
                            const result = await tx
                              .update(users)
                              .set(buildUserData(false))
                              .where(eq(users.username, record.username))
                              .returning({ id: users.id })
                            createdUser = result[0]
                          } else {
                            // 如果用户名不存在，尝试使用原始ID创建
                            try {
                              // 先检查原始ID是否已被占用
                              const existingUserWithId = await tx
                                .select()
                                .from(users)
                                .where(eq(users.id, record.id))
                                .limit(1)

                              if (existingUserWithId.length > 0) {
                                // ID已被占用，让数据库自动生成新ID
                                const result = await tx
                                  .insert(users)
                                  .values(buildUserData(true))
                                  .returning({ id: users.id })
                                createdUser = result[0]
                              } else {
                                // ID未被占用，使用原始ID
                                const result = await tx
                                  .insert(users)
                                  .values({
                                    ...buildUserData(true),
                                    id: record.id
                                  })
                                  .returning({ id: users.id })
                                createdUser = result[0]
                              }
                            } catch (error) {
                              // 如果创建失败（可能是ID冲突），让数据库自动生成ID
                              console.warn(
                                `用户 ${record.username} 使用原始ID创建失败，使用自动生成ID: ${error.message}`
                              )
                              const result = await tx
                                .insert(users)
                                .values(buildUserData(true))
                                .returning({ id: users.id })
                              createdUser = result[0]
                            }
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingUserWithId = await tx
                            .select()
                            .from(users)
                            .where(eq(users.id, record.id))
                            .limit(1)

                          if (existingUserWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有用户
                            console.warn(
                              `用户ID ${record.id} (${record.username}) 已存在，将更新现有用户`
                            )
                            const result = await tx
                              .update(users)
                              .set(buildUserData(false)) // 不包含密码，避免覆盖现有密码
                              .where(eq(users.id, record.id))
                              .returning({ id: users.id })
                            createdUser = result[0]
                          } else {
                            // ID不存在，检查用户名是否冲突（针对保留的超级管理员等情况）
                            const existingUserWithUsername = await tx
                              .select()
                              .from(users)
                              .where(eq(users.username, record.username))
                              .limit(1)

                            if (existingUserWithUsername.length > 0) {
                              // 用户名已存在（如保留的admin），更新该用户，并建立映射
                              console.warn(
                                `用户 ${record.username} (ID ${record.id}) 的用户名已存在于 ID ${existingUserWithUsername[0].id}，将合并数据`
                              )
                              const result = await tx
                                .update(users)
                                .set(buildUserData(false))
                                .where(eq(users.id, existingUserWithUsername[0].id))
                                .returning({ id: users.id })
                              createdUser = result[0]
                            } else {
                              // ID不存在且用户名不冲突，使用原始ID创建
                              const result = await tx
                                .insert(users)
                                .values({
                                  ...buildUserData(true),
                                  id: record.id
                                })
                                .returning({ id: users.id })
                              createdUser = result[0]
                            }
                          }
                        }
                        // 建立ID映射
                        if (record.id && createdUser.id) {
                          userIdMapping.set(record.id, createdUser.id)
                        }
                        break

                      case 'userIdentities':
                        // 验证必需字段
                        let validIdentityUserId = record.userId
                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) {
                            validIdentityUserId = mappedUserId
                          } else {
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.userId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(
                                `身份关联记录的用户ID ${record.userId} 不存在，跳过此记录`
                              )
                              break
                            }
                          }
                        } else {
                          console.warn(`身份关联记录缺少userId，跳过此记录`)
                          break
                        }

                        const identityData = {
                          userId: validIdentityUserId,
                          provider: record.provider,
                          providerUserId: record.providerUserId,
                          providerUsername: record.providerUsername,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                        }

                        if (mode === 'merge') {
                          await tx
                            .insert(userIdentities)
                            .values(identityData)
                            .onConflictDoUpdate({
                              target: [userIdentities.provider, userIdentities.providerUserId],
                              set: identityData
                            })
                        } else {
                          if (record.id) {
                            const existing = await tx
                              .select()
                              .from(userIdentities)
                              .where(eq(userIdentities.id, record.id))
                              .limit(1)
                            if (existing.length > 0) {
                              await tx
                                .update(userIdentities)
                                .set(identityData)
                                .where(eq(userIdentities.id, record.id))
                            } else {
                              await tx.insert(userIdentities).values({
                                ...identityData,
                                id: record.id
                              })
                            }
                          } else {
                            await tx.insert(userIdentities).values(identityData)
                          }
                        }
                        break

                      case 'userStatusLogs':
                        // 验证外键约束 - 用户ID
                        let validUserStatusLogUserId = record.userId

                        // 使用ID映射查找实际的用户ID
                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) {
                            validUserStatusLogUserId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.userId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(
                                `用户状态日志的用户ID ${record.userId} 不存在，跳过此记录`
                              )
                              return // 跳过此记录，因为userId是必需的
                            }
                          }
                        } else {
                          console.warn(`用户状态日志缺少userId，跳过此记录`)
                          return // 跳过此记录，因为userId是必需的
                        }

                        // 构建用户状态日志数据
                        const userStatusLogData = {
                          userId: validUserStatusLogUserId,
                          oldStatus: record.oldStatus || record.previousStatus || null,
                          newStatus: record.newStatus,
                          reason: record.reason || null,
                          operatorId: record.operatorId || record.changedBy || null,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                        }

                        if (mode === 'merge') {
                          // 对于状态日志，通常不需要检查重复，直接创建新记录
                          await tx.insert(userStatusLogs).values(userStatusLogData)
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          if (record.id) {
                            const existingLogWithId = await tx
                              .select()
                              .from(userStatusLogs)
                              .where(eq(userStatusLogs.id, record.id))
                              .limit(1)

                            if (existingLogWithId.length > 0) {
                              // ID已存在，更新现有记录
                              console.warn(`用户状态日志ID ${record.id} 已存在，将更新现有记录`)
                              await tx
                                .update(userStatusLogs)
                                .set(userStatusLogData)
                                .where(eq(userStatusLogs.id, record.id))
                            } else {
                              // ID不存在，使用原始ID创建
                              await tx.insert(userStatusLogs).values({
                                ...userStatusLogData,
                                id: record.id
                              })
                            }
                          } else {
                            // 没有ID，让数据库自动生成
                            await tx.insert(userStatusLogs).values(userStatusLogData)
                          }
                        }
                        break

                      case 'songs':
                        // 验证外键约束
                        let validRequesterId = record.requesterId
                        let validPreferredPlayTimeId = record.preferredPlayTimeId

                        // 使用ID映射查找实际的用户ID
                        if (record.requesterId) {
                          const mappedUserId = userIdMapping.get(record.requesterId)
                          if (mappedUserId) {
                            validRequesterId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.requesterId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(
                                `歌曲 ${record.title} 的请求者ID ${record.requesterId} 不存在，跳过此记录`
                              )
                              return // 跳过此记录，因为requesterId是必需的
                            }
                          }
                        } else {
                          console.warn(`歌曲 ${record.title} 缺少requesterId，跳过此记录`)
                          return // 跳过此记录，因为requesterId是必需的
                        }

                        // 检查preferredPlayTimeId是否存在（可选字段）
                        if (record.preferredPlayTimeId) {
                          const playTimeExists = await tx
                            .select()
                            .from(playTimes)
                            .where(eq(playTimes.id, record.preferredPlayTimeId))
                            .limit(1)
                          if (playTimeExists.length === 0) {
                            console.warn(
                              `歌曲 ${record.title} 的播放时间ID ${record.preferredPlayTimeId} 不存在，将设为null`
                            )
                            validPreferredPlayTimeId = null
                          }
                        }

                        // 动态构建歌曲数据，自动跳过不存在的字段
                        const songData = {
                          requesterId: validRequesterId, // 必需字段
                          preferredPlayTimeId: validPreferredPlayTimeId // 已验证的字段
                        }

                        // 基本字段
                        const songFields = [
                          'title',
                          'artist',
                          'semester',
                          'cover',
                          'musicPlatform',
                          'musicId'
                        ]
                        songFields.forEach((field) => {
                          if (record.hasOwnProperty(field)) {
                            songData[field] = record[field]
                          }
                        })

                        // 布尔字段，提供默认值
                        songData.played = record.hasOwnProperty('played') ? record.played : false

                        // 日期字段
                        if (record.hasOwnProperty('playedAt') && record.playedAt) {
                          songData.playedAt = new Date(record.playedAt)
                        } else {
                          songData.playedAt = null
                        }

                        if (record.hasOwnProperty('createdAt') && record.createdAt) {
                          songData.createdAt = new Date(record.createdAt)
                        } else {
                          songData.createdAt = new Date()
                        }

                        if (record.hasOwnProperty('updatedAt') && record.updatedAt) {
                          songData.updatedAt = new Date(record.updatedAt)
                        } else {
                          songData.updatedAt = new Date()
                        }

                        let createdSong
                        if (mode === 'merge') {
                          // 检查是否存在相同的歌曲（按标题和艺术家）
                          const existingSong = await tx
                            .select()
                            .from(songs)
                            .where(
                              and(eq(songs.title, record.title), eq(songs.artist, record.artist))
                            )
                            .limit(1)

                          if (existingSong.length > 0) {
                            // 如果存在相同歌曲，更新它
                            const result = await tx
                              .update(songs)
                              .set(songData)
                              .where(eq(songs.id, existingSong[0].id))
                              .returning({ id: songs.id })
                            createdSong = result[0]
                          } else {
                            // 如果不存在，尝试使用原始ID创建
                            try {
                              // 先检查原始ID是否已被占用
                              const existingSongWithId = await tx
                                .select()
                                .from(songs)
                                .where(eq(songs.id, record.id))
                                .limit(1)

                              if (existingSongWithId.length > 0) {
                                // ID已被占用，让数据库自动生成新ID
                                const result = await tx
                                  .insert(songs)
                                  .values(songData)
                                  .returning({ id: songs.id })
                                createdSong = result[0]
                              } else {
                                // ID未被占用，使用原始ID
                                const result = await tx
                                  .insert(songs)
                                  .values({
                                    ...songData,
                                    id: record.id
                                  })
                                  .returning({ id: songs.id })
                                createdSong = result[0]
                              }
                            } catch (error) {
                              // 如果创建失败（可能是ID冲突），让数据库自动生成ID
                              console.warn(
                                `歌曲 ${record.title} 使用原始ID创建失败，使用自动生成ID: ${error.message}`
                              )
                              const result = await tx
                                .insert(songs)
                                .values(songData)
                                .returning({ id: songs.id })
                              createdSong = result[0]
                            }
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingSongWithId = await tx
                            .select()
                            .from(songs)
                            .where(eq(songs.id, record.id))
                            .limit(1)

                          if (existingSongWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有歌曲
                            console.warn(
                              `歌曲ID ${record.id} (${record.title} - ${record.artist}) 已存在，将更新现有歌曲`
                            )
                            const result = await tx
                              .update(songs)
                              .set(songData)
                              .where(eq(songs.id, record.id))
                              .returning({ id: songs.id })
                            createdSong = result[0]
                          } else {
                            // ID不存在，使用原始ID创建
                            const result = await tx
                              .insert(songs)
                              .values({
                                ...songData,
                                id: record.id
                              })
                              .returning({ id: songs.id })
                            createdSong = result[0]
                          }
                        }
                        // 建立歌曲ID映射
                        if (record.id && createdSong.id) {
                          songIdMapping.set(record.id, createdSong.id)
                        }
                        break

                      case 'playTimes':
                        // 动态构建播放时段数据，自动跳过不存在的字段
                        const playTimeData = {}
                        const playTimeFields = ['name', 'startTime', 'endTime', 'description']

                        playTimeFields.forEach((field) => {
                          if (record.hasOwnProperty(field)) {
                            playTimeData[field] = record[field]
                          }
                        })

                        // 布尔字段，提供默认值
                        playTimeData.enabled = record.hasOwnProperty('enabled')
                          ? record.enabled
                          : true

                        if (mode === 'merge') {
                          // 检查是否存在相同名称的播放时段
                          const existingPlayTime = await tx
                            .select()
                            .from(playTimes)
                            .where(eq(playTimes.name, record.name))
                            .limit(1)

                          if (existingPlayTime.length > 0) {
                            // 如果存在相同播放时段，更新它
                            await tx
                              .update(playTimes)
                              .set(playTimeData)
                              .where(eq(playTimes.id, existingPlayTime[0].id))
                          } else {
                            // 如果不存在，创建新播放时段（不指定ID，让数据库自动生成）
                            await tx.insert(playTimes).values(playTimeData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingPlayTimeWithId = await tx
                            .select()
                            .from(playTimes)
                            .where(eq(playTimes.id, record.id))
                            .limit(1)

                          if (existingPlayTimeWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有播放时段
                            console.warn(
                              `播放时段ID ${record.id} (${record.name}) 已存在，将更新现有播放时段`
                            )
                            await tx
                              .update(playTimes)
                              .set(playTimeData)
                              .where(eq(playTimes.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(playTimes).values({
                              ...playTimeData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'semesters':
                        // 动态构建学期数据，自动跳过不存在的字段
                        const semesterData = {}
                        const semesterFields = ['name']

                        semesterFields.forEach((field) => {
                          if (record.hasOwnProperty(field)) {
                            semesterData[field] = record[field]
                          }
                        })

                        // 布尔字段，提供默认值
                        semesterData.isActive = record.hasOwnProperty('isActive')
                          ? record.isActive
                          : false

                        if (mode === 'merge') {
                          const existingSemester = await tx
                            .select()
                            .from(semesters)
                            .where(eq(semesters.name, semesterData.name))
                            .limit(1)
                          if (existingSemester.length > 0) {
                            await tx
                              .update(semesters)
                              .set(semesterData)
                              .where(eq(semesters.name, semesterData.name))
                          } else {
                            await tx.insert(semesters).values(semesterData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingSemesterWithId = await tx
                            .select()
                            .from(semesters)
                            .where(eq(semesters.id, record.id))
                            .limit(1)

                          if (existingSemesterWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有学期
                            console.warn(
                              `学期ID ${record.id} (${record.name}) 已存在，将更新现有学期`
                            )
                            await tx
                              .update(semesters)
                              .set(semesterData)
                              .where(eq(semesters.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(semesters).values({
                              ...semesterData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'systemSettings':
                        // 动态构建系统设置数据，自动跳过不存在的字段
                        const systemSettingsData = {}
                        const systemSettingsFields = [
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
                          'enableRequestTimeLimitation',
                          'forceBlockAllRequests'
                        ]

                        // 只添加备份数据中存在的字段
                        systemSettingsFields.forEach((field) => {
                          if (record.hasOwnProperty(field)) {
                            systemSettingsData[field] = record[field]
                          }
                        })

                        if (mode === 'merge') {
                          // 检查是否存在系统设置记录（通常只有一条记录）
                          const existingSystemSettings = await tx
                            .select()
                            .from(systemSettings)
                            .limit(1)

                          if (existingSystemSettings.length > 0) {
                            // 如果存在系统设置，更新它
                            await tx
                              .update(systemSettings)
                              .set(systemSettingsData)
                              .where(eq(systemSettings.id, existingSystemSettings[0].id))
                          } else {
                            // 如果不存在，创建新系统设置（不指定ID，让数据库自动生成）
                            await tx.insert(systemSettings).values(systemSettingsData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingSystemSettingsWithId = await tx
                            .select()
                            .from(systemSettings)
                            .where(eq(systemSettings.id, record.id))
                            .limit(1)

                          if (existingSystemSettingsWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有系统设置
                            console.warn(`系统设置ID ${record.id} 已存在，将更新现有系统设置`)
                            await tx
                              .update(systemSettings)
                              .set(systemSettingsData)
                              .where(eq(systemSettings.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(systemSettings).values({
                              ...systemSettingsData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'schedules':
                        // 验证必需字段
                        if (!record.songId) {
                          console.warn(`排期记录缺少songId，跳过此记录`)
                          return
                        }

                        if (!record.playDate) {
                          console.warn(`排期记录缺少playDate，跳过此记录`)
                          return
                        }

                        // 使用ID映射查找实际的歌曲ID
                        let validSongId = record.songId
                        const mappedSongId = songIdMapping.get(record.songId)
                        if (mappedSongId) {
                          validSongId = mappedSongId
                        } else {
                          // 尝试直接查找歌曲ID
                          const songExists = await tx
                            .select()
                            .from(songs)
                            .where(eq(songs.id, record.songId))
                            .limit(1)
                          if (songExists.length === 0) {
                            console.warn(`排期记录的歌曲ID ${record.songId} 不存在，跳过此记录`)
                            return
                          }
                        }

                        // 验证playTimeId是否存在（可选字段）
                        let validPlayTimeId = record.playTimeId
                        if (record.playTimeId) {
                          const playTimeExists = await tx
                            .select()
                            .from(playTimes)
                            .where(eq(playTimes.id, record.playTimeId))
                            .limit(1)
                          if (playTimeExists.length === 0) {
                            console.warn(
                              `排期记录的播放时间ID ${record.playTimeId} 不存在，将设为null`
                            )
                            validPlayTimeId = null
                          }
                        }

                        // 动态构建排期数据，自动跳过不存在的字段
                        const scheduleData = {
                          songId: validSongId,
                          playDate: new Date(record.playDate),
                          playTimeId: validPlayTimeId
                        }

                        // 布尔字段，提供默认值
                        scheduleData.played = record.hasOwnProperty('played')
                          ? record.played
                          : false

                        // 数字字段，提供默认值
                        scheduleData.sequence = record.hasOwnProperty('sequence')
                          ? record.sequence
                          : 1

                        if (mode === 'merge') {
                          // 检查是否存在相同的排期（按歌曲ID和播放日期）
                          const existingSchedule = await tx
                            .select()
                            .from(schedules)
                            .where(
                              and(
                                eq(schedules.songId, validSongId),
                                eq(schedules.playDate, new Date(record.playDate))
                              )
                            )
                            .limit(1)

                          if (existingSchedule.length > 0) {
                            // 如果存在相同排期，更新它
                            await tx
                              .update(schedules)
                              .set(scheduleData)
                              .where(eq(schedules.id, existingSchedule[0].id))
                          } else {
                            // 如果不存在，创建新排期（不指定ID，让数据库自动生成）
                            await tx.insert(schedules).values(scheduleData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingScheduleWithId = await tx
                            .select()
                            .from(schedules)
                            .where(eq(schedules.id, record.id))
                            .limit(1)

                          if (existingScheduleWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有排期
                            console.warn(`排期ID ${record.id} 已存在，将更新现有排期`)
                            await tx
                              .update(schedules)
                              .set(scheduleData)
                              .where(eq(schedules.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(schedules).values({
                              ...scheduleData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'notificationSettings':
                        // 验证userId是否存在
                        let validUserId = record.userId
                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) {
                            validUserId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.userId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(`通知设置的用户ID ${record.userId} 不存在，跳过此记录`)
                              return
                            }
                          }
                        }

                        // 动态构建通知设置数据，自动跳过不存在的字段
                        const notificationSettingsData = { userId: validUserId }
                        const notificationFields = [
                          'refreshInterval',
                          'songVotedThreshold',
                          'meowUserId'
                        ]

                        notificationFields.forEach((field) => {
                          if (record.hasOwnProperty(field)) {
                            notificationSettingsData[field] = record[field]
                          }
                        })

                        // 布尔字段，提供默认值
                        notificationSettingsData.enabled = record.hasOwnProperty('enabled')
                          ? record.enabled
                          : true
                        notificationSettingsData.songRequestEnabled = record.hasOwnProperty(
                          'songRequestEnabled'
                        )
                          ? record.songRequestEnabled
                          : true
                        notificationSettingsData.songVotedEnabled = record.hasOwnProperty(
                          'songVotedEnabled'
                        )
                          ? record.songVotedEnabled
                          : true
                        notificationSettingsData.songPlayedEnabled = record.hasOwnProperty(
                          'songPlayedEnabled'
                        )
                          ? record.songPlayedEnabled
                          : true

                        // 数字字段，提供默认值
                        if (!notificationSettingsData.hasOwnProperty('refreshInterval')) {
                          notificationSettingsData.refreshInterval = 60
                        }
                        if (!notificationSettingsData.hasOwnProperty('songVotedThreshold')) {
                          notificationSettingsData.songVotedThreshold = 1
                        }

                        // 日期字段
                        notificationSettingsData.createdAt = record.createdAt
                          ? new Date(record.createdAt)
                          : new Date()
                        notificationSettingsData.updatedAt = record.updatedAt
                          ? new Date(record.updatedAt)
                          : new Date()

                        if (mode === 'merge') {
                          // 使用userId作为唯一标识进行upsert，因为数据库中userId有唯一约束
                          await tx
                            .insert(notificationSettings)
                            .values(notificationSettingsData)
                            .onConflictDoUpdate({
                              target: notificationSettings.userId,
                              set: notificationSettingsData
                            })
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingNotificationSettingsWithId = await tx
                            .select()
                            .from(notificationSettings)
                            .where(eq(notificationSettings.id, record.id))
                            .limit(1)

                          if (existingNotificationSettingsWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有通知设置
                            console.warn(`通知设置ID ${record.id} 已存在，将更新现有通知设置`)
                            await tx
                              .update(notificationSettings)
                              .set(notificationSettingsData)
                              .where(eq(notificationSettings.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(notificationSettings).values({
                              ...notificationSettingsData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'notifications':
                        // 验证userId是否存在
                        let validNotificationUserId = record.userId
                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) {
                            validNotificationUserId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.userId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(`通知的用户ID ${record.userId} 不存在，跳过此记录`)
                              break
                            }
                          }
                        }

                        // 动态构建通知数据，自动跳过不存在的字段
                        const notificationData = { userId: validNotificationUserId }
                        const notificationDataFields = ['title', 'message', 'type']

                        notificationDataFields.forEach((field) => {
                          if (record.hasOwnProperty(field)) {
                            notificationData[field] = record[field]
                          }
                        })

                        // 布尔字段，提供默认值
                        notificationData.read = record.hasOwnProperty('read') ? record.read : false

                        // 日期字段
                        notificationData.createdAt = record.createdAt
                          ? new Date(record.createdAt)
                          : new Date()
                        notificationData.updatedAt = record.updatedAt
                          ? new Date(record.updatedAt)
                          : new Date()

                        if (mode === 'merge') {
                          // 检查是否存在相同的通知（按用户ID、类型和消息）
                          const existingNotification = await tx
                            .select()
                            .from(notifications)
                            .where(
                              and(
                                eq(notifications.userId, validNotificationUserId),
                                eq(notifications.type, record.type),
                                eq(notifications.message, record.message)
                              )
                            )
                            .limit(1)

                          if (existingNotification.length > 0) {
                            // 如果存在相同通知，更新它
                            await tx
                              .update(notifications)
                              .set(notificationData)
                              .where(eq(notifications.id, existingNotification[0].id))
                          } else {
                            // 如果不存在，创建新通知（不指定ID，让数据库自动生成）
                            await tx.insert(notifications).values(notificationData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingNotificationWithId = await tx
                            .select()
                            .from(notifications)
                            .where(eq(notifications.id, record.id))
                            .limit(1)

                          if (existingNotificationWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有通知
                            console.warn(`通知ID ${record.id} 已存在，将更新现有通知`)
                            await tx
                              .update(notifications)
                              .set(notificationData)
                              .where(eq(notifications.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(notifications).values({
                              ...notificationData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'songBlacklist':
                        // 验证createdBy字段（可选）
                        let validCreatedBy = record.createdBy

                        if (record.createdBy) {
                          // 使用ID映射查找实际的用户ID
                          const mappedUserId = userIdMapping.get(record.createdBy)
                          if (mappedUserId) {
                            validCreatedBy = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.createdBy))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(
                                `黑名单记录的创建者ID ${record.createdBy} 不存在，将设为null`
                              )
                              validCreatedBy = null
                            }
                          }
                        }

                        // 构建黑名单数据
                        const blacklistData = {
                          type: record.type || 'KEYWORD', // 默认为关键词类型
                          value: record.value || '',
                          reason: record.reason || null,
                          isActive: record.hasOwnProperty('isActive') ? record.isActive : true,
                          createdBy: validCreatedBy,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }

                        if (mode === 'merge') {
                          // 检查是否存在相同的黑名单记录（相同类型和值）
                          const existingBlacklist = await tx
                            .select()
                            .from(songBlacklists)
                            .where(
                              and(
                                eq(songBlacklists.type, blacklistData.type),
                                eq(songBlacklists.value, blacklistData.value)
                              )
                            )
                            .limit(1)

                          if (existingBlacklist.length > 0) {
                            // 如果存在相同记录，更新它
                            await tx
                              .update(songBlacklists)
                              .set(blacklistData)
                              .where(eq(songBlacklists.id, existingBlacklist[0].id))
                          } else {
                            // 如果不存在，创建新记录（不指定ID，让数据库自动生成）
                            await tx.insert(songBlacklists).values(blacklistData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          const existingBlacklistWithId = await tx
                            .select()
                            .from(songBlacklists)
                            .where(eq(songBlacklists.id, record.id))
                            .limit(1)

                          if (existingBlacklistWithId.length > 0) {
                            // ID已存在，使用upsert策略更新现有记录
                            console.warn(`黑名单ID ${record.id} 已存在，将更新现有记录`)
                            await tx
                              .update(songBlacklists)
                              .set(blacklistData)
                              .where(eq(songBlacklists.id, record.id))
                          } else {
                            // ID不存在，使用原始ID创建
                            await tx.insert(songBlacklists).values({
                              ...blacklistData,
                              id: record.id
                            })
                          }
                        }
                        break

                      case 'songCollaborators':
                        // 验证外键
                        let validCollabUserId = record.userId
                        let validCollabSongId = record.songId

                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) validCollabUserId = mappedUserId
                        }

                        if (record.songId) {
                          const mappedSongId = songIdMapping.get(record.songId)
                          if (mappedSongId) validCollabSongId = mappedSongId
                        }

                        const collabData = {
                          id: record.id, // UUID
                          songId: validCollabSongId,
                          userId: validCollabUserId,
                          status: record.status || 'PENDING',
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }

                        // UUID 表直接插入，如果冲突则更新
                        await tx.insert(songCollaborators).values(collabData).onConflictDoUpdate({
                          target: songCollaborators.id,
                          set: collabData
                        })
                        break

                      case 'collaborationLogs':
                        // 验证外键 (collaboratorId 是 UUID，通常不变，但如果是重新生成的...)
                        // 这里假设 UUID 在 restore songCollaborators 时保持一致
                        const logData = {
                          id: record.id,
                          collaboratorId: record.collaboratorId,
                          action: record.action,
                          operatorId: record.operatorId, // 可能需要映射，但 operatorId 是 integer
                          ipAddress: record.ipAddress,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                        }

                        // 映射 operatorId
                        if (record.operatorId) {
                          const mappedOpId = userIdMapping.get(record.operatorId)
                          if (mappedOpId) logData.operatorId = mappedOpId
                        }

                        await tx.insert(collaborationLogs).values(logData).onConflictDoUpdate({
                          target: collaborationLogs.id,
                          set: logData
                        })
                        break

                      case 'songReplayRequests':
                        // 验证外键
                        let validReplayUserId = record.userId
                        let validReplaySongId = record.songId

                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) validReplayUserId = mappedUserId
                        }

                        if (record.songId) {
                          const mappedSongId = songIdMapping.get(record.songId)
                          if (mappedSongId) validReplaySongId = mappedSongId
                        }

                        const replayData = {
                          songId: validReplaySongId,
                          userId: validReplayUserId,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }

                        if (mode === 'merge') {
                          await tx
                            .insert(songReplayRequests)
                            .values(replayData)
                            .onConflictDoNothing()
                        } else {
                          // 完全恢复模式
                          if (record.id) {
                            const existing = await tx
                              .select()
                              .from(songReplayRequests)
                              .where(eq(songReplayRequests.id, record.id))
                              .limit(1)
                            if (existing.length > 0) {
                              await tx
                                .update(songReplayRequests)
                                .set(replayData)
                                .where(eq(songReplayRequests.id, record.id))
                            } else {
                              await tx.insert(songReplayRequests).values({
                                ...replayData,
                                id: record.id
                              })
                            }
                          } else {
                            await tx.insert(songReplayRequests).values(replayData)
                          }
                        }
                        break

                      case 'votes':
                        // 验证外键约束
                        let validVoteUserId = record.userId
                        let validVoteSongId = record.songId

                        // 使用ID映射查找实际的用户ID
                        if (record.userId) {
                          const mappedUserId = userIdMapping.get(record.userId)
                          if (mappedUserId) {
                            validVoteUserId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.userId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(`投票记录的用户ID ${record.userId} 不存在，跳过此记录`)
                              return // 跳过此记录，因为userId是必需的
                            }
                          }
                        } else {
                          console.warn(`投票记录缺少userId，跳过此记录`)
                          return // 跳过此记录，因为userId是必需的
                        }

                        // 使用ID映射查找实际的歌曲ID
                        if (record.songId) {
                          const mappedSongId = songIdMapping.get(record.songId)
                          if (mappedSongId) {
                            validVoteSongId = mappedSongId
                          } else {
                            // 尝试直接查找歌曲ID
                            const songExists = await tx
                              .select()
                              .from(songs)
                              .where(eq(songs.id, record.songId))
                              .limit(1)
                            if (songExists.length === 0) {
                              console.warn(`投票记录的歌曲ID ${record.songId} 不存在，跳过此记录`)
                              return // 跳过此记录，因为songId是必需的
                            }
                          }
                        } else {
                          console.warn(`投票记录缺少songId，跳过此记录`)
                          return // 跳过此记录，因为songId是必需的
                        }

                        // 构建投票数据
                        const voteData = {
                          userId: validVoteUserId,
                          songId: validVoteSongId,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                        }

                        if (mode === 'merge') {
                          // 检查是否存在相同的投票（同一用户对同一歌曲的投票）
                          const existingVote = await tx
                            .select()
                            .from(votes)
                            .where(
                              and(
                                eq(votes.userId, validVoteUserId),
                                eq(votes.songId, validVoteSongId)
                              )
                            )
                            .limit(1)

                          if (existingVote.length > 0) {
                            // 如果存在相同投票，更新它
                            await tx
                              .update(votes)
                              .set(voteData)
                              .where(eq(votes.id, existingVote[0].id))
                          } else {
                            // 如果不存在，创建新投票（不指定ID，让数据库自动生成）
                            await tx.insert(votes).values(voteData)
                          }
                        } else {
                          // 完全恢复模式，检查是否存在相同的投票（同一用户对同一歌曲的投票）
                          const existingVote = await tx
                            .select()
                            .from(votes)
                            .where(
                              and(
                                eq(votes.userId, validVoteUserId),
                                eq(votes.songId, validVoteSongId)
                              )
                            )
                            .limit(1)

                          if (existingVote.length > 0) {
                            // 如果存在相同投票，更新它
                            await tx
                              .update(votes)
                              .set(voteData)
                              .where(eq(votes.id, existingVote[0].id))
                          } else {
                            // 如果不存在，创建新投票（不指定ID，让数据库自动生成）
                            await tx.insert(votes).values(voteData)
                          }
                        }
                        break

                      case 'requestTimes':
                        // requestTimes表没有外键依赖
                        const requestTimeData = {
                          name: record.name,
                          startTime: record.startTime ? new Date(record.startTime) : null,
                          endTime: record.endTime ? new Date(record.endTime) : null,
                          enabled: record.enabled !== undefined ? record.enabled : true,
                          description: record.description || null,
                          expected: record.expected || 0,
                          accepted: record.accepted || 0,
                          past: record.past !== undefined ? record.past : false,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }

                        if (mode === 'merge') {
                          // 检查是否存在相同名称的请求时段
                          const existingRequestTime = await tx
                            .select()
                            .from(requestTimes)
                            .where(eq(requestTimes.name, record.name))
                            .limit(1)

                          if (existingRequestTime.length > 0) {
                            // 如果存在，更新它
                            await tx
                              .update(requestTimes)
                              .set(requestTimeData)
                              .where(eq(requestTimes.id, existingRequestTime[0].id))
                          } else {
                            // 如果不存在，创建新记录
                            await tx.insert(requestTimes).values(requestTimeData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          if (record.id) {
                            const existingRequestTimeWithId = await tx
                              .select()
                              .from(requestTimes)
                              .where(eq(requestTimes.id, record.id))
                              .limit(1)

                            if (existingRequestTimeWithId.length > 0) {
                              // ID已存在，更新现有记录
                              await tx
                                .update(requestTimes)
                                .set(requestTimeData)
                                .where(eq(requestTimes.id, record.id))
                            } else {
                              // ID不存在，使用原始ID创建
                              await tx.insert(requestTimes).values({
                                ...requestTimeData,
                                id: record.id
                              })
                            }
                          } else {
                            // 没有ID，创建新记录
                            await tx.insert(requestTimes).values(requestTimeData)
                          }
                        }
                        break

                      case 'emailTemplates':
                        // 验证外键约束 - updatedByUserId
                        let validEmailTemplateUpdatedByUserId = record.updatedByUserId

                        if (record.updatedByUserId) {
                          const mappedUserId = userIdMapping.get(record.updatedByUserId)
                          if (mappedUserId) {
                            validEmailTemplateUpdatedByUserId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.updatedByUserId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(
                                `邮件模板的更新者ID ${record.updatedByUserId} 不存在，将设置为null`
                              )
                              validEmailTemplateUpdatedByUserId = null
                            }
                          }
                        }

                        // 构建邮件模板数据
                        const emailTemplateData = {
                          key: record.key,
                          name: record.name,
                          subject: record.subject,
                          html: record.html,
                          updatedByUserId: validEmailTemplateUpdatedByUserId,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }

                        if (mode === 'merge') {
                          // 检查是否存在相同key的邮件模板
                          const existingEmailTemplate = await tx
                            .select()
                            .from(emailTemplates)
                            .where(eq(emailTemplates.key, record.key))
                            .limit(1)

                          if (existingEmailTemplate.length > 0) {
                            // 如果存在，更新它
                            await tx
                              .update(emailTemplates)
                              .set(emailTemplateData)
                              .where(eq(emailTemplates.id, existingEmailTemplate[0].id))
                          } else {
                            // 如果不存在，创建新记录
                            await tx.insert(emailTemplates).values(emailTemplateData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          if (record.id) {
                            const existingEmailTemplateWithId = await tx
                              .select()
                              .from(emailTemplates)
                              .where(eq(emailTemplates.id, record.id))
                              .limit(1)

                            if (existingEmailTemplateWithId.length > 0) {
                              // ID已存在，更新现有记录
                              await tx
                                .update(emailTemplates)
                                .set(emailTemplateData)
                                .where(eq(emailTemplates.id, record.id))
                            } else {
                              // ID不存在，使用原始ID创建
                              await tx.insert(emailTemplates).values({
                                ...emailTemplateData,
                                id: record.id
                              })
                            }
                          } else {
                            // 没有ID，创建新记录
                            await tx.insert(emailTemplates).values(emailTemplateData)
                          }
                        }
                        break

                      case 'apiKeys':
                        // 验证外键约束 - createdByUserId
                        let validApiKeyCreatedByUserId = record.createdByUserId

                        if (record.createdByUserId) {
                          const mappedUserId = userIdMapping.get(record.createdByUserId)
                          if (mappedUserId) {
                            validApiKeyCreatedByUserId = mappedUserId
                          } else {
                            // 尝试直接查找用户ID
                            const userExists = await tx
                              .select()
                              .from(users)
                              .where(eq(users.id, record.createdByUserId))
                              .limit(1)
                            if (userExists.length === 0) {
                              console.warn(
                                `API密钥的创建者ID ${record.createdByUserId} 不存在，跳过此记录`
                              )
                              return // 跳过此记录，因为createdByUserId是必需的
                            }
                          }
                        } else {
                          console.warn(`API密钥缺少createdByUserId，跳过此记录`)
                          return // 跳过此记录，因为createdByUserId是必需的
                        }

                        // 构建API密钥数据
                        const apiKeyData = {
                          name: record.name,
                          description: record.description || null,
                          keyHash: record.keyHash,
                          keyPrefix: record.keyPrefix,
                          isActive: record.isActive !== undefined ? record.isActive : true,
                          expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
                          lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
                          createdByUserId: validApiKeyCreatedByUserId,
                          usageCount: record.usageCount || 0
                        }

                        if (mode === 'merge') {
                          // 检查是否存在相同keyHash的API密钥
                          const existingApiKey = await tx
                            .select()
                            .from(apiKeys)
                            .where(eq(apiKeys.keyHash, record.keyHash))
                            .limit(1)

                          if (existingApiKey.length > 0) {
                            // 如果存在，更新它
                            await tx
                              .update(apiKeys)
                              .set(apiKeyData)
                              .where(eq(apiKeys.id, existingApiKey[0].id))
                          } else {
                            // 如果不存在，创建新记录
                            await tx.insert(apiKeys).values(apiKeyData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          if (record.id) {
                            const existingApiKeyWithId = await tx
                              .select()
                              .from(apiKeys)
                              .where(eq(apiKeys.id, record.id))
                              .limit(1)

                            if (existingApiKeyWithId.length > 0) {
                              // ID已存在，更新现有记录
                              await tx
                                .update(apiKeys)
                                .set(apiKeyData)
                                .where(eq(apiKeys.id, record.id))
                            } else {
                              // ID不存在，使用原始ID创建
                              await tx.insert(apiKeys).values({
                                ...apiKeyData,
                                id: record.id
                              })
                            }
                          } else {
                            // 没有ID，创建新记录
                            await tx.insert(apiKeys).values(apiKeyData)
                          }
                        }
                        break

                      case 'apiKeyPermissions':
                        // 验证外键约束 - apiKeyId
                        const validApiKeyPermissionApiKeyId = record.apiKeyId

                        if (record.apiKeyId) {
                          // 尝试直接查找API密钥ID
                          const apiKeyExists = await tx
                            .select()
                            .from(apiKeys)
                            .where(eq(apiKeys.id, record.apiKeyId))
                            .limit(1)
                          if (apiKeyExists.length === 0) {
                            console.warn(
                              `API密钥权限的API密钥ID ${record.apiKeyId} 不存在，跳过此记录`
                            )
                            return // 跳过此记录，因为apiKeyId是必需的
                          }
                        } else {
                          console.warn(`API密钥权限缺少apiKeyId，跳过此记录`)
                          return // 跳过此记录，因为apiKeyId是必需的
                        }

                        // 构建API密钥权限数据
                        const apiKeyPermissionData = {
                          apiKeyId: validApiKeyPermissionApiKeyId,
                          permission: record.permission,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
                        }

                        if (mode === 'merge') {
                          // 检查是否存在相同的API密钥权限
                          const existingApiKeyPermission = await tx
                            .select()
                            .from(apiKeyPermissions)
                            .where(
                              and(
                                eq(apiKeyPermissions.apiKeyId, validApiKeyPermissionApiKeyId),
                                eq(apiKeyPermissions.permission, record.permission)
                              )
                            )
                            .limit(1)

                          if (existingApiKeyPermission.length > 0) {
                            // 如果存在，更新它
                            await tx
                              .update(apiKeyPermissions)
                              .set(apiKeyPermissionData)
                              .where(eq(apiKeyPermissions.id, existingApiKeyPermission[0].id))
                          } else {
                            // 如果不存在，创建新记录
                            await tx.insert(apiKeyPermissions).values(apiKeyPermissionData)
                          }
                        } else {
                          // 完全恢复模式，检查ID是否已存在
                          if (record.id) {
                            const existingApiKeyPermissionWithId = await tx
                              .select()
                              .from(apiKeyPermissions)
                              .where(eq(apiKeyPermissions.id, record.id))
                              .limit(1)

                            if (existingApiKeyPermissionWithId.length > 0) {
                              // ID已存在，更新现有记录
                              await tx
                                .update(apiKeyPermissions)
                                .set(apiKeyPermissionData)
                                .where(eq(apiKeyPermissions.id, record.id))
                            } else {
                              // ID不存在，使用原始ID创建
                              await tx.insert(apiKeyPermissions).values({
                                ...apiKeyPermissionData,
                                id: record.id
                              })
                            }
                          } else {
                            // 没有ID，创建新记录
                            await tx.insert(apiKeyPermissions).values(apiKeyPermissionData)
                          }
                        }
                        break

                      case 'apiLogs':
                        // 验证外键约束 - apiKeyId（可选）
                        let validApiLogApiKeyId = record.apiKeyId

                        if (record.apiKeyId) {
                          // 尝试直接查找API密钥ID
                          const apiKeyExists = await tx
                            .select()
                            .from(apiKeys)
                            .where(eq(apiKeys.id, record.apiKeyId))
                            .limit(1)
                          if (apiKeyExists.length === 0) {
                            console.warn(
                              `API日志的API密钥ID ${record.apiKeyId} 不存在，将设置为null`
                            )
                            validApiLogApiKeyId = null
                          }
                        }

                        // 构建API日志数据
                        const apiLogData = {
                          apiKeyId: validApiLogApiKeyId,
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

                        // API日志通常不需要检查重复，直接创建新记录
                        await tx.insert(apiLogs).values(apiLogData)
                        break

                      // 其他表的处理逻辑...
                      default:
                        console.warn(`暂不支持恢复表: ${tableName}`)
                        return // 跳出当前事务，不处理此记录
                    }
                  },
                  {
                    timeout: 15000, // 每个记录事务15秒超时
                    maxWait: 3000 // 最大等待时间3秒
                  }
                )

                // 成功处理，跳出重试循环
                restoredCount++
                break
              } catch (recordError) {
                lastError = recordError
                retryCount++

                // 检查是否是可重试的错误
                // Postgres 错误代码:
                // 23505: unique_violation (唯一约束冲突)
                // 23503: foreign_key_violation (外键约束冲突)
                // 40001: serialization_failure (序列化失败)
                // 40P01: deadlock_detected (死锁检测)
                const isRetryableError =
                  recordError.code === '23505' || // 唯一约束冲突
                  recordError.code === '23503' || // 外键约束冲突
                  recordError.code === '40001' || // 序列化失败
                  recordError.code === '40P01' || // 死锁
                  recordError.message.includes('timeout') ||
                  recordError.message.includes('connection') ||
                  recordError.message.includes('SQLITE_BUSY') ||
                  recordError.message.includes('database is locked')

                if (retryCount <= maxRetries && isRetryableError) {
                  console.warn(
                    `恢复记录失败，第 ${retryCount}/${maxRetries} 次重试 (${tableName}):`,
                    recordError.message
                  )

                  // 根据错误类型调整重试策略
                  if (recordError.code === '23505') {
                    // 唯一约束冲突，等待更长时间
                    await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
                  } else {
                    // 其他错误，短暂等待
                    await new Promise((resolve) => setTimeout(resolve, 500 * retryCount))
                  }
                } else {
                  // 不可重试的错误或重试次数用完
                  break
                }
              }
            }

            // 如果所有重试都失败了，记录错误
            if (retryCount > maxRetries && lastError) {
              console.error(`恢复记录最终失败 (${tableName}):`, lastError)
              restoreResults.details.errors.push(
                `${tableName}: ${lastError.message} (重试${maxRetries}次后失败)`
              )
              consecutiveErrors++

              // 如果连续错误过多，减少批处理大小
              if (consecutiveErrors >= 3 && batchSize > 1) {
                batchSize = Math.max(1, Math.floor(batchSize / 2))
                consecutiveErrors = 0
                console.warn(`由于连续错误，将批处理大小调整为: ${batchSize}`)
              }
            } else if (retryCount <= maxRetries) {
              // 成功处理，重置连续错误计数
              consecutiveErrors = 0
            }
          }

          // 每批处理完后输出进度
          console.log(
            `${tableName}: 已处理 ${Math.min(i + batchSize, tableData.length)}/${tableData.length} 条记录`
          )
        }

        console.log(`✅ ${tableName}: 恢复了 ${restoredCount}/${tableData.length} 条记录`)
        restoreResults.details.recordsRestored += restoredCount
        restoreResults.details.tablesProcessed++
      } catch (tableError) {
        console.error(`恢复表 ${tableName} 失败:`, tableError)
        restoreResults.details.errors.push(`表 ${tableName}: ${tableError.message}`)
      }
    }

    console.log(`✅ 数据恢复完成`)
    console.log(`📊 处理了 ${restoreResults.details.tablesProcessed} 个表`)
    console.log(`📊 恢复了 ${restoreResults.details.recordsRestored} 条记录`)

    // 重置所有自增序列
    console.log(`🔄 开始重置自增序列...`)
    const sequenceResetResults = []
    const tablesToReset = [
      'Song',
      'User',
      'UserIdentity',
      'UserStatusLog',
      'Vote',
      'Schedule',
      'Notification',
      'NotificationSettings',
      'PlayTime',
      'Semester',
      'SystemSettings',
      'SongBlacklist',
      'SongReplayRequest',
      'RequestTime',
      'EmailTemplate'
    ]

    for (const tableName of tablesToReset) {
      try {
        // 调用 fix-sequence 端点
        const response = await $fetch('/api/admin/fix-sequence', {
          method: 'POST',
          body: { table: tableName },
          headers: {
            'Content-Type': 'application/json',
            Authorization: getRequestHeader(event, 'authorization') || ''
          }
        })

        if (response.success) {
          sequenceResetResults.push(`${tableName}: 序列已重置`)
          console.log(`✅ ${tableName} 序列重置成功`)
        } else {
          const errorMsg = `${tableName}: 序列重置失败 - ${response.error}`
          sequenceResetResults.push(errorMsg)
          console.warn(`⚠️ ${errorMsg}`)
        }
      } catch (sequenceError) {
        const errorMsg = `${tableName}: 序列重置失败 - ${sequenceError.message}`
        sequenceResetResults.push(errorMsg)
        console.warn(`⚠️ ${errorMsg}`)
      }
    }

    // 将序列重置结果添加到详情中
    restoreResults.details.sequenceResets = sequenceResetResults
    console.log(`✅ 序列重置完成`)

    if (restoreResults.details.errors.length > 0) {
      console.warn(`⚠️ 发生了 ${restoreResults.details.errors.length} 个错误`)
      restoreResults.success = false
      restoreResults.message = '数据恢复完成，但存在错误'
    }

    // 清除所有缓存
    try {
      const cacheService = CacheService.getInstance()
      await cacheService.clearAllCaches()
      console.log('数据恢复后缓存已清除')
    } catch (cacheError) {
      console.warn('清除缓存失败:', cacheError)
      restoreResults.details.warnings = restoreResults.details.warnings || []
      restoreResults.details.warnings.push('清除缓存失败')
    }

    return restoreResults
  } catch (error) {
    console.error('恢复数据库备份失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '恢复数据库备份失败'
    })
  }
})
