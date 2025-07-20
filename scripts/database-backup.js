const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

async function createFullBackup() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔍 开始创建完整数据库备份...')
    
    // 创建备份数据对象
    const backupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        creator: 'script',
        description: `完整数据库备份 - ${new Date().toLocaleString('zh-CN')}`,
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
      systemSettings: {
        query: () => prisma.systemSettings.findMany(),
        description: '系统设置'
      }
    }

    let totalRecords = 0

    for (const [tableName, tableConfig] of Object.entries(tablesToBackup)) {
      try {
        console.log(`📦 备份表: ${tableName}`)
        const tableData = await tableConfig.query()
        
        backupData.data[tableName] = tableData
        backupData.metadata.tables.push({
          name: tableName,
          description: tableConfig.description,
          recordCount: tableData.length
        })
        
        totalRecords += tableData.length
        console.log(`✅ ${tableName}: ${tableData.length} 条记录`)
      } catch (error) {
        console.error(`❌ 备份表 ${tableName} 失败:`, error.message)
        // 继续备份其他表
      }
    }

    backupData.metadata.totalRecords = totalRecords

    // 创建备份目录
    const backupDir = path.join(__dirname, '../backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `database-backup-${timestamp}.json`
    const filepath = path.join(backupDir, filename)

    // 保存备份文件
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8')

    console.log(`\n✅ 备份完成: ${filename}`)
    console.log(`📊 总计备份 ${totalRecords} 条记录`)
    console.log(`📁 备份文件大小: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`)

    return filepath

  } catch (error) {
    console.error('❌ 创建数据库备份失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function restoreFromBackup(backupFilePath) {
  const prisma = new PrismaClient()
  
  try {
    console.log(`🔄 开始从备份恢复数据: ${backupFilePath}`)
    
    // 读取备份文件
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('备份文件不存在')
    }

    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'))

    // 验证备份文件格式
    if (!backupData.metadata || !backupData.data) {
      throw new Error('备份文件格式无效')
    }

    console.log(`备份文件信息:`)
    console.log(`- 版本: ${backupData.metadata.version}`)
    console.log(`- 创建时间: ${backupData.metadata.timestamp}`)
    console.log(`- 创建者: ${backupData.metadata.creator}`)
    console.log(`- 总记录数: ${backupData.metadata.totalRecords}`)

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

    let totalRestored = 0

    // 开始事务恢复
    await prisma.$transaction(async (tx) => {
      for (const tableName of restoreOrder) {
        if (!backupData.data[tableName]) {
          continue
        }

        const tableData = backupData.data[tableName]
        if (!Array.isArray(tableData) || tableData.length === 0) {
          continue
        }

        console.log(`🔄 恢复表: ${tableName} (${tableData.length} 条记录)`)
        
        let restoredCount = 0

        for (const record of tableData) {
          try {
            // 根据表名选择恢复策略
            switch (tableName) {
              case 'users':
                await tx.user.upsert({
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
                break

              case 'songs':
                const songData = {
                  title: record.title,
                  artist: record.artist,
                  requesterId: record.requesterId,
                  played: record.played,
                  playedAt: record.playedAt ? new Date(record.playedAt) : null,
                  semester: record.semester,
                  preferredPlayTimeId: record.preferredPlayTimeId,
                  cover: record.cover,
                  musicPlatform: record.musicPlatform,
                  musicId: record.musicId
                }
                
                await tx.song.upsert({
                  where: { id: record.id },
                  update: songData,
                  create: { ...songData, id: record.id }
                })
                break

              // 其他表的处理逻辑可以在这里添加...
              default:
                console.warn(`暂不支持恢复表: ${tableName}`)
                continue
            }

            restoredCount++
          } catch (recordError) {
            console.error(`恢复记录失败 (${tableName}):`, recordError.message)
          }
        }

        console.log(`✅ ${tableName}: 恢复了 ${restoredCount}/${tableData.length} 条记录`)
        totalRestored += restoredCount
      }
    })

    console.log(`\n✅ 数据恢复完成`)
    console.log(`📊 总计恢复 ${totalRestored} 条记录`)

  } catch (error) {
    console.error('❌ 恢复数据库备份失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 命令行参数处理
const command = process.argv[2]
const backupFile = process.argv[3]

if (command === 'backup') {
  createFullBackup()
    .then((filepath) => {
      console.log('\n🎉 完整备份创建成功!')
      console.log(`💡 恢复命令: node scripts/database-backup.js restore "${filepath}"`)
    })
    .catch((error) => {
      console.error('备份失败:', error)
      process.exit(1)
    })
} else if (command === 'restore') {
  if (!backupFile) {
    console.error('请指定备份文件路径')
    console.log('用法: node scripts/database-backup.js restore <备份文件路径>')
    process.exit(1)
  }
  
  restoreFromBackup(backupFile)
    .then(() => {
      console.log('\n🎉 数据恢复完成!')
    })
    .catch((error) => {
      console.error('恢复失败:', error)
      process.exit(1)
    })
} else {
  console.log('VoiceHub 数据库备份工具')
  console.log('')
  console.log('用法:')
  console.log('  创建备份: node scripts/database-backup.js backup')
  console.log('  恢复备份: node scripts/database-backup.js restore <备份文件路径>')
  console.log('')
  console.log('示例:')
  console.log('  node scripts/database-backup.js backup')
  console.log('  node scripts/database-backup.js restore backups/database-backup-2024-01-01T12-00-00-000Z.json')
}
