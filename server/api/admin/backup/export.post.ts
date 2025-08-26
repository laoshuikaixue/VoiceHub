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
      },
      songBlacklist: {
        query: () => prisma.songBlacklist.findMany(),
        description: '歌曲黑名单'
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

    // 生成备份文件名（用于下载）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePrefix = tables === 'users' ? 'users-backup' : 'database-backup'
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
