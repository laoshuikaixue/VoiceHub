import { createError, defineEventHandler, readBody } from 'h3'
import { db } from '~/drizzle/db'
import {
  apiKeys,
  apiKeyPermissions,
  apiLogs,
  collaborationLogs,
  emailTemplates,
  notifications,
  notificationSettings,
  playTimes,
  requestTimes,
  schedules,
  semesters,
  songBlacklists,
  songCollaborators,
  songReplayRequests,
  songs,
  systemSettings,
  users,
  userIdentities,
  userStatusLogs,
  votes
} from '~/drizzle/schema'
import { promises as fs } from 'fs'
import path from 'path'

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

    const body = await readBody(event)
    const { tables = 'all', includeSystemData = true } = body

    console.log('开始创建数据库备份...')

    // 创建备份数据对象
    const backupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        creator: user.username,
        description: '',
        backupType: 'custom',
        tables: [],
        totalRecords: 0
      },
      data: {}
    }

    // 定义要备份的表和对应的查询
    const tablesToBackup = {
      users: {
        query: async () => {
          const usersData = await db.select().from(users)
          const settingsData = await db.select().from(notificationSettings)

          // 手动关联通知设置
          return usersData.map((user) => ({
            ...user,
            notificationSettings: settingsData.filter((setting) => setting.userId === user.id)
          }))
        },
        description: '用户数据'
      },
      songs: {
        query: async () => {
          const songsData = await db.select().from(songs)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)
          const votesData = await db.select().from(votes)
          const schedulesData = await db.select().from(schedules)
          const playTimesData = await db.select().from(playTimes)

          // 手动关联数据
          return songsData.map((song) => ({
            ...song,
            requester: usersData.find((user) => user.id === song.requesterId),
            votes: votesData
              .filter((vote) => vote.songId === song.id)
              .map((vote) => ({
                ...vote,
                user: usersData.find((user) => user.id === vote.userId)
              })),
            schedules: schedulesData.filter((schedule) => schedule.songId === song.id),
            preferredPlayTime: playTimesData.find((pt) => pt.id === song.preferredPlayTimeId)
          }))
        },
        description: '歌曲数据'
      },
      votes: {
        query: async () => {
          const votesData = await db.select().from(votes)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)
          const songsData = await db
            .select({
              id: songs.id,
              title: songs.title,
              artist: songs.artist
            })
            .from(songs)

          return votesData.map((vote) => ({
            ...vote,
            user: usersData.find((user) => user.id === vote.userId),
            song: songsData.find((song) => song.id === vote.songId)
          }))
        },
        description: '投票数据'
      },
      schedules: {
        query: async () => {
          const schedulesData = await db.select().from(schedules)
          const songsData = await db
            .select({
              id: songs.id,
              title: songs.title,
              artist: songs.artist
            })
            .from(songs)
          const playTimesData = await db.select().from(playTimes)

          return schedulesData.map((schedule) => ({
            ...schedule,
            song: songsData.find((song) => song.id === schedule.songId),
            playTime: playTimesData.find((pt) => pt.id === schedule.playTimeId)
          }))
        },
        description: '排期数据'
      },
      notifications: {
        query: async () => {
          const notificationsData = await db.select().from(notifications)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)
          const songsData = await db
            .select({
              id: songs.id,
              title: songs.title,
              artist: songs.artist
            })
            .from(songs)

          return notificationsData.map((notification) => ({
            ...notification,
            user: usersData.find((user) => user.id === notification.userId),
            song: notification.songId
              ? songsData.find((song) => song.id === notification.songId)
              : null
          }))
        },
        description: '通知数据'
      },
      notificationSettings: {
        query: async () => {
          const settingsData = await db.select().from(notificationSettings)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)

          return settingsData.map((setting) => ({
            ...setting,
            user: usersData.find((user) => user.id === setting.userId)
          }))
        },
        description: '通知设置'
      },
      playTimes: {
        query: () => db.select().from(playTimes),
        description: '播出时段'
      },
      semesters: {
        query: () => db.select().from(semesters),
        description: '学期数据'
      },
      songBlacklist: {
        query: () => db.select().from(songBlacklists),
        description: '歌曲黑名单'
      },
      userStatusLogs: {
        query: async () => {
          const statusLogsData = await db.select().from(userStatusLogs)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)

          return statusLogsData.map((log) => ({
            ...log,
            user: usersData.find((user) => user.id === log.userId)
          }))
        },
        description: '用户状态变更日志'
      },
      userIdentities: {
        query: async () => {
          const identitiesData = await db.select().from(userIdentities)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)

          return identitiesData.map((identity) => ({
            ...identity,
            user: usersData.find((user) => user.id === identity.userId)
          }))
        },
        description: '第三方身份关联'
      },
      songCollaborators: {
        query: async () => {
          const collaboratorsData = await db.select().from(songCollaborators)
          return collaboratorsData
        },
        description: '联合投稿人'
      },
      collaborationLogs: {
        query: async () => {
          const logsData = await db.select().from(collaborationLogs)
          return logsData
        },
        description: '联合投稿审计日志'
      },
      songReplayRequests: {
        query: async () => {
          const requestsData = await db.select().from(songReplayRequests)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)
          const songsData = await db
            .select({
              id: songs.id,
              title: songs.title,
              artist: songs.artist
            })
            .from(songs)

          return requestsData.map((req) => ({
            ...req,
            user: usersData.find((user) => user.id === req.userId),
            song: songsData.find((song) => song.id === req.songId)
          }))
        },
        description: '歌曲重播申请'
      },
      apiKeys: {
        query: async () => {
          const apiKeysData = await db.select().from(apiKeys)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)
          const permissionsData = await db.select().from(apiKeyPermissions)

          return apiKeysData.map((key) => ({
            ...key,
            createdByUser: usersData.find((user) => user.id === key.createdByUserId),
            permissions: permissionsData.filter((perm) => perm.apiKeyId === key.id)
          }))
        },
        description: 'API密钥'
      },
      apiKeyPermissions: {
        query: () => db.select().from(apiKeyPermissions),
        description: 'API密钥权限'
      },
      apiLogs: {
        query: async () => {
          const logsData = await db.select().from(apiLogs)
          const apiKeysData = await db
            .select({
              id: apiKeys.id,
              name: apiKeys.name
            })
            .from(apiKeys)

          return logsData.map((log) => ({
            ...log,
            apiKey: log.apiKeyId ? apiKeysData.find((key) => key.id === log.apiKeyId) : null
          }))
        },
        description: 'API访问日志'
      },
      emailTemplates: {
        query: async () => {
          const templatesData = await db.select().from(emailTemplates)
          const usersData = await db
            .select({
              id: users.id,
              username: users.username,
              name: users.name
            })
            .from(users)

          return templatesData.map((template) => ({
            ...template,
            updatedByUser: template.updatedByUserId
              ? usersData.find((user) => user.id === template.updatedByUserId)
              : null
          }))
        },
        description: '邮件模板'
      },
      requestTimes: {
        query: () => db.select().from(requestTimes),
        description: '请求时段'
      }
    }

    // 如果包含系统数据，添加系统设置表
    if (includeSystemData) {
      tablesToBackup.systemSettings = {
        query: () => db.select().from(systemSettings),
        description: '系统设置'
      }
    }

    // 根据请求的表进行备份
    let tablesToProcess
    if (tables === 'all') {
      tablesToProcess = Object.keys(tablesToBackup)
    } else if (tables === 'users') {
      // 仅备份用户相关数据
      tablesToProcess = ['users', 'notificationSettings', 'userStatusLogs', 'userIdentities']
      // 如果包含系统数据，也添加到处理列表中
      if (includeSystemData) {
        tablesToProcess.push('systemSettings')
      }
    } else if (Array.isArray(tables)) {
      tablesToProcess = tables
    } else {
      tablesToProcess = [tables]
    }

    if (
      includeSystemData &&
      tablesToBackup.systemSettings &&
      !tablesToProcess.includes('systemSettings')
    ) {
      tablesToProcess.push('systemSettings')
    }

    if (tablesToProcess.length === 1 && tablesToProcess[0] === 'systemSettings') {
      backupData.metadata.backupType = 'system'
      backupData.metadata.description = `系统配置备份 - ${new Date().toLocaleString('zh-CN')}`
    } else if (tables === 'users') {
      backupData.metadata.backupType = 'users'
      backupData.metadata.description = `用户数据备份 - ${new Date().toLocaleString('zh-CN')}`
    } else if (tables === 'all') {
      backupData.metadata.backupType = 'full'
      backupData.metadata.description = `完整数据库备份 - ${new Date().toLocaleString('zh-CN')}`
    } else if (tables === 'songs') {
      backupData.metadata.backupType = 'songs'
      backupData.metadata.description = `歌曲数据备份 - ${new Date().toLocaleString('zh-CN')}`
    } else {
      backupData.metadata.description = `自定义数据库备份 - ${new Date().toLocaleString('zh-CN')}`
    }

    let totalRecords = 0

    for (const tableName of tablesToProcess) {
      if (!tablesToBackup[tableName]) {
        console.warn(`未知的表名: ${tableName}`)
        continue
      }

      try {
        console.log(`备份表: ${tableName}`)
        const tableData = await tablesToBackup[tableName].query()

        backupData.data[tableName] = tableData
        backupData.metadata.tables.push({
          name: tableName,
          description: tablesToBackup[tableName].description,
          recordCount: tableData.length
        })

        totalRecords += tableData.length
        console.log(`✅ ${tableName}: ${tableData.length} 条记录`)
      } catch (error) {
        // 检查是否为表不存在错误
        // Postgres 错误代码 42P01: undefined_table (表不存在)
        const isTableMissing =
          error.code === '42P01' ||
          (error.message && error.message.includes('does not exist')) ||
          (error.statusMessage && error.statusMessage.includes('does not exist'))

        if (isTableMissing) {
          console.warn(`⚠️ 表 ${tableName} 不存在，跳过备份`)
          // 记录一个空的条目，以便知道跳过了
          backupData.metadata.tables.push({
            name: tableName,
            description: `${tablesToBackup[tableName].description} (表不存在，已跳过)`,
            recordCount: 0,
            skipped: true
          })
          continue
        }

        console.error(`备份表 ${tableName} 失败:`, error)
        throw createError({
          statusCode: 500,
          statusMessage: `备份表 ${tableName} 失败: ${error.message}`
        })
      }
    }

    backupData.metadata.totalRecords = totalRecords

    // 生成备份文件名（用于下载）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    let filePrefix = 'database-backup'

    if (tables === 'users') {
      filePrefix = includeSystemData ? 'users-system-backup' : 'users-backup'
    } else if (tablesToProcess.length === 1 && tablesToProcess[0] === 'systemSettings') {
      filePrefix = 'system-settings-backup'
    } else if (tables === 'songs') {
      filePrefix = includeSystemData ? 'songs-system-backup' : 'songs-backup'
    }

    const filename = `${filePrefix}-${timestamp}.json`

    console.log(`✅ 备份完成: ${filename}`)
    console.log(`📊 总计备份 ${totalRecords} 条记录`)

    // 检测运行环境
    const isVercel = process.env.VERCEL || process.env.VERCEL_ENV
    const isNetlify = process.env.NETLIFY
    const isServerless = isVercel || isNetlify

    if (isServerless) {
      // 在无服务器环境中，直接返回备份数据供前端下载
      console.log('🌐 检测到无服务器环境，直接返回备份数据')

      // 计算数据大小（估算）
      const dataSize = JSON.stringify(backupData).length

      return {
        success: true,
        message: '数据库备份创建成功',
        backup: {
          filename,
          data: backupData,
          size: dataSize,
          metadata: backupData.metadata,
          downloadMode: 'direct' // 标识为直接下载模式
        }
      }
    } else {
      // 在传统服务器环境中，保存到文件系统
      try {
        const backupDir = path.join(process.cwd(), 'backups')
        try {
          await fs.access(backupDir)
        } catch {
          await fs.mkdir(backupDir, { recursive: true })
        }

        const filepath = path.join(backupDir, filename)
        await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8')

        return {
          success: true,
          message: '数据库备份创建成功',
          backup: {
            filename,
            filepath,
            size: (await fs.stat(filepath)).size,
            metadata: backupData.metadata,
            downloadMode: 'file' // 标识为文件下载模式
          }
        }
      } catch (fsError) {
        console.warn('文件系统操作失败，回退到直接返回模式:', fsError.message)

        // 如果文件系统操作失败，回退到直接返回模式
        const dataSize = JSON.stringify(backupData).length
        return {
          success: true,
          message: '数据库备份创建成功（直接下载模式）',
          backup: {
            filename,
            data: backupData,
            size: dataSize,
            metadata: backupData.metadata,
            downloadMode: 'direct'
          }
        }
      }
    }
  } catch (error) {
    console.error('创建数据库备份失败:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || '创建数据库备份失败'
    })
  }
})
