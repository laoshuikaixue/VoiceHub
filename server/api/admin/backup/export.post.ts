import { createError, defineEventHandler, readBody } from 'h3'
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

    const body = await readBody(event)
    const { tables = 'all', includeSystemData = true } = body

    console.log('开始创建数据库备份...')

    // 根据备份类型生成描述
    const backupTypeDesc = tables === 'users' ? '用户数据备份' : '完整数据库备份'

    // 创建备份数据对象
    const backupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        creator: user.username,
        description: `${backupTypeDesc} - ${new Date().toLocaleString('zh-CN')}`,
        backupType: tables === 'users' ? 'users' : 'full',
        tables: [],
        totalRecords: 0
      },
      data: {}
    }

    // 定义要备份的表和对应的查询
    const tablesToBackup = {
      users: {
        query: () => prisma.user.findMany({
          include: {
            notificationSettings: true
          }
        }),
        description: '用户数据'
      },
      songs: {
        query: () => prisma.song.findMany({
          include: {
            requester: {
              select: { id: true, username: true, name: true }
            },
            votes: {
              include: {
                user: {
                  select: { id: true, username: true, name: true }
                }
              }
            },
            schedules: true,
            preferredPlayTime: true
          }
        }),
        description: '歌曲数据'
      },
      votes: {
        query: () => prisma.vote.findMany({
          include: {
            user: {
              select: { id: true, username: true, name: true }
            },
            song: {
              select: { id: true, title: true, artist: true }
            }
          }
        }),
        description: '投票数据'
      },
      schedules: {
        query: () => prisma.schedule.findMany({
          include: {
            song: {
              select: { id: true, title: true, artist: true }
            },
            playTime: true
          }
        }),
        description: '排期数据'
      },
      notifications: {
        query: () => prisma.notification.findMany({
          include: {
            user: {
              select: { id: true, username: true, name: true }
            },
            song: {
              select: { id: true, title: true, artist: true }
            }
          }
        }),
        description: '通知数据'
      },
      notificationSettings: {
        query: () => prisma.notificationSettings.findMany({
          include: {
            user: {
              select: { id: true, username: true, name: true }
            }
          }
        }),
        description: '通知设置'
      },
      playTimes: {
        query: () => prisma.playTime.findMany(),
        description: '播出时段'
      },
      semesters: {
        query: () => prisma.semester.findMany(),
        description: '学期数据'
      }
    }

    // 如果包含系统数据，添加系统设置表
    if (includeSystemData) {
      tablesToBackup.systemSettings = {
        query: () => prisma.systemSettings.findMany(),
        description: '系统设置'
      }
    }

    // 根据请求的表进行备份
    let tablesToProcess
    if (tables === 'all') {
      tablesToProcess = Object.keys(tablesToBackup)
    } else if (tables === 'users') {
      // 仅备份用户相关数据
      tablesToProcess = ['users', 'notificationSettings']
    } else if (Array.isArray(tables)) {
      tablesToProcess = tables
    } else {
      tablesToProcess = [tables]
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
        console.error(`备份表 ${tableName} 失败:`, error)
        throw createError({
          statusCode: 500,
          statusMessage: `备份表 ${tableName} 失败: ${error.message}`
        })
      }
    }

    backupData.metadata.totalRecords = totalRecords

    // 创建备份目录
    const backupDir = path.join(process.cwd(), 'backups')
    try {
      await fs.access(backupDir)
    } catch {
      await fs.mkdir(backupDir, { recursive: true })
    }

    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePrefix = tables === 'users' ? 'users-backup' : 'database-backup'
    const filename = `${filePrefix}-${timestamp}.json`
    const filepath = path.join(backupDir, filename)

    // 保存备份文件
    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8')

    console.log(`✅ 备份完成: ${filename}`)
    console.log(`📊 总计备份 ${totalRecords} 条记录`)

    return {
      success: true,
      message: '数据库备份创建成功',
      backup: {
        filename,
        filepath,
        size: (await fs.stat(filepath)).size,
        metadata: backupData.metadata
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
