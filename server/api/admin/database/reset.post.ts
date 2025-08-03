import { createError, defineEventHandler } from 'h3'
import { prisma } from '../../../models/schema'

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

    console.log(`开始重置数据库，操作者: ${user.name} (${user.username})`)

    const resetResults = {
      success: true,
      message: '数据库重置完成',
      details: {
        tablesCleared: 0,
        recordsDeleted: 0,
        errors: [],
        preservedData: []
      }
    }

    try {
      // 使用事务确保数据一致性
      await prisma.$transaction(async (tx) => {
        // 按照外键依赖顺序删除数据
        console.log('删除通知数据...')
        const deletedNotifications = await tx.notification.deleteMany()
        resetResults.details.recordsDeleted += deletedNotifications.count
        resetResults.details.tablesCleared++

        console.log('删除通知设置...')
        const deletedNotificationSettings = await tx.notificationSettings.deleteMany()
        resetResults.details.recordsDeleted += deletedNotificationSettings.count
        resetResults.details.tablesCleared++

        console.log('删除排期数据...')
        const deletedSchedules = await tx.schedule.deleteMany()
        resetResults.details.recordsDeleted += deletedSchedules.count
        resetResults.details.tablesCleared++

        console.log('删除投票数据...')
        const deletedVotes = await tx.vote.deleteMany()
        resetResults.details.recordsDeleted += deletedVotes.count
        resetResults.details.tablesCleared++

        console.log('删除歌曲数据...')
        const deletedSongs = await tx.song.deleteMany()
        resetResults.details.recordsDeleted += deletedSongs.count
        resetResults.details.tablesCleared++

        console.log('删除用户数据（保留当前管理员）...')
        const deletedUsers = await tx.user.deleteMany({
          where: {
            NOT: {
              id: user.id // 保留当前操作的管理员账户
            }
          }
        })
        resetResults.details.recordsDeleted += deletedUsers.count
        resetResults.details.tablesCleared++
        resetResults.details.preservedData.push(`保留当前管理员账户: ${user.name}`)

        console.log('删除播放时段数据...')
        const deletedPlayTimes = await tx.playTime.deleteMany()
        resetResults.details.recordsDeleted += deletedPlayTimes.count
        resetResults.details.tablesCleared++

        console.log('删除学期数据...')
        const deletedSemesters = await tx.semester.deleteMany()
        resetResults.details.recordsDeleted += deletedSemesters.count
        resetResults.details.tablesCleared++

        // 系统设置保持不变
        resetResults.details.preservedData.push('系统设置已保留')

        console.log(`✅ 数据库重置完成`)
        console.log(`- 清空表数量: ${resetResults.details.tablesCleared}`)
        console.log(`- 删除记录数: ${resetResults.details.recordsDeleted}`)
        console.log(`- 保留数据: ${resetResults.details.preservedData.join(', ')}`)
      })

      return resetResults

    } catch (error) {
      console.error('数据库重置失败:', error)
      resetResults.success = false
      resetResults.message = '数据库重置失败'
      resetResults.details.errors.push(error.message)
      
      throw createError({
        statusCode: 500,
        statusMessage: `数据库重置失败: ${error.message}`
      })
    }

  } catch (error) {
    console.error('重置数据库时发生错误:', error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: '服务器内部错误'
    })
  }
})