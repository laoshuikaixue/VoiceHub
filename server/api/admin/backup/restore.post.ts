import { createError, defineEventHandler, readBody, readMultipartFormData } from 'h3'
import { prisma } from '../../../models/schema'
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
        await prisma.notification.deleteMany()
        await prisma.notificationSettings.deleteMany()
        await prisma.schedule.deleteMany()
        await prisma.vote.deleteMany()
        await prisma.song.deleteMany()
        await prisma.user.deleteMany()
        await prisma.playTime.deleteMany()
        await prisma.semester.deleteMany()
        await prisma.systemSettings.deleteMany()
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
      'users',
      'songs',
      'votes',
      'schedules',
      'notificationSettings',
      'notifications'
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
        const batchSize = 10 // 进一步减少批次大小
        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize)
          
          // 逐条处理记录，每条记录使用独立事务
          for (const record of batch) {
            try {
              await prisma.$transaction(async (tx) => {
                // 根据表名选择恢复策略
                switch (tableName) {
                  case 'users':
                    let createdUser
                    if (mode === 'merge') {
                      createdUser = await tx.user.upsert({
                        where: { username: record.username },
                        update: {
                          name: record.name,
                          grade: record.grade,
                          class: record.class,
                          role: record.role,
                          lastLogin: record.lastLogin ? new Date(record.lastLogin) : null,
                          lastLoginIp: record.lastLoginIp,
                          passwordChangedAt: record.passwordChangedAt ? new Date(record.passwordChangedAt) : null
                        },
                        create: {
                          username: record.username,
                          name: record.name,
                          password: record.password,
                          grade: record.grade,
                          class: record.class,
                          role: record.role,
                          lastLogin: record.lastLogin ? new Date(record.lastLogin) : null,
                          lastLoginIp: record.lastLoginIp,
                          passwordChangedAt: record.passwordChangedAt ? new Date(record.passwordChangedAt) : null
                        }
                      })
                    } else {
                      createdUser = await tx.user.create({
                        data: {
                          username: record.username,
                          name: record.name,
                          password: record.password,
                          grade: record.grade,
                          class: record.class,
                          role: record.role,
                          lastLogin: record.lastLogin ? new Date(record.lastLogin) : null,
                          lastLoginIp: record.lastLoginIp,
                          passwordChangedAt: record.passwordChangedAt ? new Date(record.passwordChangedAt) : null
                        }
                      })
                    }
                    // 建立ID映射
                    if (record.id && createdUser.id) {
                      userIdMapping.set(record.id, createdUser.id)
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
                        const userExists = await tx.user.findUnique({
                          where: { id: record.requesterId }
                        })
                        if (!userExists) {
                          console.warn(`歌曲 ${record.title} 的请求者ID ${record.requesterId} 不存在，跳过此记录`)
                          return // 跳过此记录，因为requesterId是必需的
                        }
                      }
                    } else {
                      console.warn(`歌曲 ${record.title} 缺少requesterId，跳过此记录`)
                      return // 跳过此记录，因为requesterId是必需的
                    }
                    
                    // 检查preferredPlayTimeId是否存在（可选字段）
                    if (record.preferredPlayTimeId) {
                      const playTimeExists = await tx.playTime.findUnique({
                        where: { id: record.preferredPlayTimeId }
                      })
                      if (!playTimeExists) {
                        console.warn(`歌曲 ${record.title} 的播放时间ID ${record.preferredPlayTimeId} 不存在，将设为null`)
                        validPreferredPlayTimeId = null
                      }
                    }
                    
                    const songData = {
                      title: record.title,
                      artist: record.artist,
                      requesterId: validRequesterId,
                      played: record.played || false,
                      playedAt: record.playedAt ? new Date(record.playedAt) : null,
                      semester: record.semester,
                      preferredPlayTimeId: validPreferredPlayTimeId,
                      cover: record.cover,
                      musicPlatform: record.musicPlatform,
                      musicId: record.musicId
                    }
                    
                    let createdSong
                    if (mode === 'merge') {
                      createdSong = await tx.song.upsert({
                        where: { id: record.id },
                        update: songData,
                        create: { ...songData, id: record.id }
                      })
                    } else {
                      createdSong = await tx.song.create({ data: songData })
                    }
                    // 建立歌曲ID映射
                    if (record.id && createdSong.id) {
                      songIdMapping.set(record.id, createdSong.id)
                    }
                    break

                  case 'playTimes':
                    if (mode === 'merge') {
                      await tx.playTime.upsert({
                        where: { id: record.id },
                        update: {
                          name: record.name,
                          startTime: record.startTime,
                          endTime: record.endTime,
                          enabled: record.enabled,
                          description: record.description
                        },
                        create: {
                          id: record.id,
                          name: record.name,
                          startTime: record.startTime,
                          endTime: record.endTime,
                          enabled: record.enabled,
                          description: record.description
                        }
                      })
                    } else {
                      await tx.playTime.create({
                        data: {
                          name: record.name,
                          startTime: record.startTime,
                          endTime: record.endTime,
                          enabled: record.enabled,
                          description: record.description
                        }
                      })
                    }
                    break

                  case 'semesters':
                    if (mode === 'merge') {
                      await tx.semester.upsert({
                        where: { name: record.name },
                        update: {
                          isActive: record.isActive
                        },
                        create: {
                          name: record.name,
                          isActive: record.isActive
                        }
                      })
                    } else {
                      await tx.semester.create({
                        data: {
                          name: record.name,
                          isActive: record.isActive
                        }
                      })
                    }
                    break

                  case 'systemSettings':
                    if (mode === 'merge') {
                      await tx.systemSettings.upsert({
                        where: { id: record.id },
                        update: {
                          enablePlayTimeSelection: record.enablePlayTimeSelection
                        },
                        create: {
                          id: record.id,
                          enablePlayTimeSelection: record.enablePlayTimeSelection
                        }
                      })
                    } else {
                      await tx.systemSettings.create({
                        data: {
                          enablePlayTimeSelection: record.enablePlayTimeSelection
                        }
                      })
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
                      const songExists = await tx.song.findUnique({
                        where: { id: record.songId }
                      })
                      if (!songExists) {
                        console.warn(`排期记录的歌曲ID ${record.songId} 不存在，跳过此记录`)
                        return
                      }
                    }
                    
                    // 验证playTimeId是否存在（可选字段）
                    let validPlayTimeId = record.playTimeId
                    if (record.playTimeId) {
                      const playTimeExists = await tx.playTime.findUnique({
                        where: { id: record.playTimeId }
                      })
                      if (!playTimeExists) {
                        console.warn(`排期记录的播放时间ID ${record.playTimeId} 不存在，将设为null`)
                        validPlayTimeId = null
                      }
                    }
                    
                    const scheduleData = {
                      songId: validSongId,
                      playDate: new Date(record.playDate),
                      played: record.played || false,
                      sequence: record.sequence || 1,
                      playTimeId: validPlayTimeId
                    }
                    
                    if (mode === 'merge') {
                      await tx.schedule.upsert({
                        where: { id: record.id },
                        update: scheduleData,
                        create: { ...scheduleData, id: record.id }
                      })
                    } else {
                      await tx.schedule.create({ data: scheduleData })
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
                        const userExists = await tx.user.findUnique({
                          where: { id: record.userId }
                        })
                        if (!userExists) {
                          console.warn(`通知设置的用户ID ${record.userId} 不存在，跳过此记录`)
                          return
                        }
                      }
                    }
                    
                    const notificationSettingsData = {
                      userId: validUserId,
                      enabled: record.enabled !== undefined ? record.enabled : true,
                      songRequestEnabled: record.songRequestEnabled !== undefined ? record.songRequestEnabled : true,
                      songVotedEnabled: record.songVotedEnabled !== undefined ? record.songVotedEnabled : true,
                      songPlayedEnabled: record.songPlayedEnabled !== undefined ? record.songPlayedEnabled : true,
                      refreshInterval: record.refreshInterval || 60,
                      songVotedThreshold: record.songVotedThreshold || 1,
                      createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                      updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                    }
                    
                    if (mode === 'merge') {
                      // 使用userId作为唯一标识进行upsert，因为数据库中userId有唯一约束
                      await tx.notificationSettings.upsert({
                        where: { userId: validUserId },
                        update: notificationSettingsData,
                        create: notificationSettingsData
                      })
                    } else {
                      // 在replace模式下，检查是否已存在该用户的设置
                      const existingSettings = await tx.notificationSettings.findUnique({
                        where: { userId: validUserId }
                      })
                      if (!existingSettings) {
                        await tx.notificationSettings.create({
                          data: notificationSettingsData
                        })
                      } else {
                        console.warn(`用户ID ${validUserId} 的通知设置已存在，跳过此记录`)
                        return
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
                        const userExists = await tx.user.findUnique({
                          where: { id: record.userId }
                        })
                        if (!userExists) {
                          console.warn(`通知的用户ID ${record.userId} 不存在，跳过此记录`)
                          break
                        }
                      }
                    }
                    
                    if (mode === 'merge') {
                      await tx.notification.upsert({
                        where: { id: record.id },
                        update: {
                          userId: validNotificationUserId,
                          title: record.title,
                          message: record.message,
                          type: record.type,
                          read: record.read,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        },
                        create: {
                          id: record.id,
                          userId: validNotificationUserId,
                          title: record.title,
                          message: record.message,
                          type: record.type,
                          read: record.read,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }
                      })
                    } else {
                      await tx.notification.create({
                        data: {
                          userId: validNotificationUserId,
                          title: record.title,
                          message: record.message,
                          type: record.type,
                          read: record.read,
                          createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
                          updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date()
                        }
                      })
                    }
                    break

                  // 其他表的处理逻辑...
                  default:
                    console.warn(`暂不支持恢复表: ${tableName}`)
                    return // 跳出当前事务，不处理此记录
                }
              }, {
                timeout: 15000, // 每个记录事务15秒超时
                maxWait: 3000, // 最大等待时间3秒
              })
              
              restoredCount++
            } catch (recordError) {
              console.error(`恢复记录失败 (${tableName}):`, recordError)
              restoreResults.details.errors.push(`${tableName}: ${recordError.message}`)
            }
          }
          
          // 每批处理完后输出进度
          console.log(`${tableName}: 已处理 ${Math.min(i + batchSize, tableData.length)}/${tableData.length} 条记录`)
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

    if (restoreResults.details.errors.length > 0) {
      console.warn(`⚠️ 发生了 ${restoreResults.details.errors.length} 个错误`)
      restoreResults.success = false
      restoreResults.message = '数据恢复完成，但存在错误'
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
